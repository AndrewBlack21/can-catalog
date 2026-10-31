import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Calculator, ImagePlus, LogOut, PackagePlus, Pencil, RefreshCw, Save, ShieldCheck, Trash2, X } from 'lucide-react';
import Header from '../../components/Header.jsx';
import { isSupabaseConfigured, supabase } from '../../lib/supabase.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { storageImageUrl } from '../../utils/storageImageUrl.js';

const blankProduct = {
  name: '', slug: '', category_id: '', description: '', price_mode: 'fixed', price: '',
  availability: 'available', stock_quantity: '', customization_enabled: false,
  featured: false, published: false
};
const slugify = (value) => value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function DashboardPage() {
  const [session, setSession] = useState(undefined);
  const [authorized, setAuthorized] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankProduct);
  const [files, setFiles] = useState([]);
  const [categoryName, setCategoryName] = useState('');
  const navigate = useNavigate();

  async function loadData() {
    const [p, c] = await Promise.all([
      supabase.from('products').select('*, categories(name), product_images(*)').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('sort_order')
    ]);
    if (p.error) setError('Falha ao carregar produtos. Confira as permissões RLS.');
    else setProducts(p.data || []);
    if (!c.error) setCategories(c.data || []);
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let alive = true;
    supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (!alive) return;
      const currentSession = sessionError ? null : data.session;
      setSession(currentSession);
      if (!currentSession) {
        setAuthorized(false);
        setCheckingAccess(false);
        return;
      }
      const { data: admin, error: adminError } = await supabase
        .from('catalog_admins')
        .select('user_id')
        .eq('user_id', currentSession.user.id)
        .maybeSingle();
      if (!alive) return;
      const isAdmin = !adminError && Boolean(admin);
      setAuthorized(isAdmin);
      if (isAdmin) await loadData();
      if (alive) setCheckingAccess(false);
    }).catch(() => {
      if (alive) {
        setSession(null);
        setAuthorized(false);
        setCheckingAccess(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (alive) setSession(next);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  if (!isSupabaseConfigured) return <Navigate to="/adm" replace />;
  if (checkingAccess || session === undefined) return <div className="empty-state">Verificando sessão e permissões...</div>;
  if (!session || !authorized) return <Navigate to="/adm" replace />;

  async function logout() { await supabase.auth.signOut(); navigate('/adm'); }
  function resetForm() { setEditingId(null); setForm(blankProduct); setFiles([]); setError(''); setNotice(''); }
  function editProduct(product) {
    setEditingId(product.id);
    setForm({
      name: product.name || '', slug: product.slug || '', category_id: product.category_id || '',
      description: product.description || '', price_mode: product.price_mode || 'fixed',
      price: product.price ?? '', availability: product.availability || 'available',
      stock_quantity: product.stock_quantity ?? '', customization_enabled: !!product.customization_enabled,
      featured: !!product.featured, published: !!product.published
    });
    setFiles([]);
    setError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function saveProduct(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const slug = slugify(form.slug || form.name);
    if (!slug) { setError('Informe um nome válido para o produto.'); setBusy(false); return; }
    const payload = {
      name: form.name.trim(), slug, category_id: form.category_id || null,
      description: form.description.trim(), price_mode: form.price_mode,
      price: form.price_mode === 'quote' ? null : Number(form.price),
      availability: form.availability,
      stock_quantity: form.stock_quantity === '' ? null : Number(form.stock_quantity),
      customization_enabled: form.customization_enabled, featured: form.featured, published: form.published
    };
    if (payload.price_mode === 'fixed' && (!Number.isFinite(payload.price) || payload.price < 0)) {
      setError('Informe um preço válido ou selecione “Sob consulta”.'); setBusy(false); return;
    }
    const result = editingId
      ? await supabase.from('products').update(payload).eq('id', editingId).select('id').single()
      : await supabase.from('products').insert(payload).select('id').single();
    if (result.error || !result.data) {
      setError(result.error?.code === '23505' ? 'Já existe um produto com esse endereço (slug). Altere o slug.' : 'Não foi possível salvar. Verifique os campos e as permissões do administrador.');
      setBusy(false); return;
    }
    const productId = result.data.id;
    for (const file of files) {
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
      const path = productId + '/' + Date.now() + '-' + safeName;
      const upload = await supabase.storage.from('product-images').upload(path, file, { contentType: file.type, upsert: false });
      if (upload.error) { setError('Produto salvo, mas uma foto não foi enviada. Confira o formato e o limite de 5 MB.'); setBusy(false); await loadData(); return; }
      const imageRow = await supabase.from('product_images').insert({ product_id: productId, storage_path: path, alt_text: payload.name, sort_order: 0 });
      if (imageRow.error) { setError('Produto salvo, mas não foi possível registrar uma foto no catálogo.'); setBusy(false); await loadData(); return; }
    }
    await loadData();
    setBusy(false);
    resetForm();
    setNotice(editingId ? 'Produto atualizado com sucesso.' : 'Produto cadastrado com sucesso.');
  }
  async function setPublished(product, published) {
    setBusy(true); setError(''); setNotice('');
    const { error: err } = await supabase.from('products').update({ published }).eq('id', product.id);
    if (err) setError('Não foi possível atualizar a publicação.');
    else { await loadData(); setNotice(published ? 'Produto publicado.' : 'Produto ocultado da vitrine.'); }
    setBusy(false);
  }
  async function deleteProduct(product) {
    if (!window.confirm('Excluir "' + product.name + '" e as referências às suas fotos?')) return;
    setBusy(true); setError(''); setNotice('');
    const paths = (product.product_images || []).map(image => image.storage_path).filter(Boolean);
    if (paths.length) await supabase.storage.from('product-images').remove(paths);
    const { error: deleteError } = await supabase.from('products').delete().eq('id', product.id);
    if (deleteError) setError('Não foi possível excluir o produto.');
    else { if (editingId === product.id) resetForm(); await loadData(); setNotice('Produto excluído.'); }
    setBusy(false);
  }
  async function addCategory(event) {
    event.preventDefault(); const name = categoryName.trim(); const slug = slugify(name);
    if (!name || !slug) return;
    setBusy(true); setError(''); setNotice('');
    const { error: categoryError } = await supabase.from('categories').insert({ name, slug, sort_order: categories.length + 1 });
    if (categoryError) setError(categoryError.code === '23505' ? 'Já existe uma categoria com esse nome.' : 'Não foi possível cadastrar a categoria.');
    else { setCategoryName(''); await loadData(); setNotice('Categoria cadastrada.'); }
    setBusy(false);
  }

  return <><Header admin/><main className="admin-main">
    <div className="admin-title-row"><div><span className="eyebrow"><ShieldCheck size={14}/> PAINEL RESTRITO</span><h1>Seu catálogo,<br/><em>sob controle.</em></h1><p>Gerencie os produtos que aparecem na vitrine CAN Group.</p></div><div className="admin-title-actions"><button className="button button-dark" onClick={() => navigate("/adm/orcamento-3d")}><Calculator size={16}/> Orçamento 3D</button><button className="button button-outline" onClick={logout}><LogOut size={16}/> Sair</button></div></div>
    <div className="stats-grid"><div className="stat-card"><span>Produtos cadastrados</span><strong>{products.length}</strong></div><div className="stat-card"><span>Publicados</span><strong>{products.filter(p => p.published).length}</strong></div><div className="stat-card"><span>Categorias ativas</span><strong>{categories.filter(c => c.active).length}</strong></div></div>
    {error && <div className="form-error" role="alert">{error}</div>}{notice && <div className="admin-success" role="status">{notice}</div>}
    <section className="admin-editor">
      <div className="admin-section-heading"><div><h2>{editingId ? 'Editar produto' : 'Cadastrar produto'}</h2><p>Use fotos reais dos itens da CAN Group. Imagens de até 5 MB.</p></div>{editingId && <button className="button button-outline" onClick={resetForm}><X size={16}/> Cancelar edição</button>}</div>
      <form className="product-form" onSubmit={saveProduct}>
        <div className="admin-form-grid">
          <label>Nome do produto<input required maxLength={140} value={form.name} onChange={e => setForm({...form, name:e.target.value, slug: editingId ? form.slug : slugify(e.target.value)})} placeholder="Ex.: Chaveiro personalizado"/></label>
          <label>Slug / endereço<input required value={form.slug} onChange={e => setForm({...form, slug:slugify(e.target.value)})} placeholder="chaveiro-personalizado"/></label>
          <label>Categoria<select value={form.category_id} onChange={e => setForm({...form, category_id:e.target.value})}><option value="">Sem categoria</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Preço<select value={form.price_mode} onChange={e => setForm({...form, price_mode:e.target.value, price:e.target.value === 'quote' ? '' : form.price})}><option value="fixed">Preço fixo</option><option value="quote">Sob consulta</option></select></label>
          {form.price_mode === 'fixed' && <label>Preço (R$)<input type="number" min="0" step="0.01" required value={form.price} onChange={e => setForm({...form, price:e.target.value})} placeholder="8,00"/></label>}
          <label>Disponibilidade<select value={form.availability} onChange={e => setForm({...form, availability:e.target.value})}><option value="available">Disponível</option><option value="made_to_order">Sob encomenda</option><option value="unavailable">Indisponível</option></select></label>
          <label>Quantidade em estoque (opcional)<input type="number" min="0" step="1" value={form.stock_quantity} onChange={e => setForm({...form, stock_quantity:e.target.value})} placeholder="Deixe vazio se não controlar"/></label>
          <label className="admin-file-field"><span><ImagePlus size={17}/> Fotos do produto</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={e => setFiles(Array.from(e.target.files || []))}/><small>{files.length ? files.map(f => f.name).join(', ') : 'JPEG, PNG, WebP ou AVIF. Até 5 MB por imagem.'}</small></label>
        </div>
        <label>Descrição<textarea rows="4" maxLength={3000} value={form.description} onChange={e => setForm({...form, description:e.target.value})} placeholder="Descreva materiais, dimensões e opções de personalização."/></label>
        <div className="admin-checkboxes"><label><input type="checkbox" checked={form.customization_enabled} onChange={e => setForm({...form, customization_enabled:e.target.checked})}/> Permite personalização</label><label><input type="checkbox" checked={form.featured} onChange={e => setForm({...form, featured:e.target.checked})}/> Destacar na vitrine</label><label><input type="checkbox" checked={form.published} onChange={e => setForm({...form, published:e.target.checked})}/> Publicar na vitrine</label></div>
        <div className="admin-form-actions"><button className="button button-dark" disabled={busy}><Save size={16}/>{busy ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar produto'}</button><button type="button" className="button button-outline" onClick={resetForm} disabled={busy}>Limpar formulário</button></div>
      </form>
    </section>
    <section className="admin-categories"><div><h2>Categorias</h2><p>Crie categorias para organizar a vitrine.</p></div><form onSubmit={addCategory}><input value={categoryName} onChange={e => setCategoryName(e.target.value)} required maxLength={80} placeholder="Nova categoria"/><button className="button button-dark" disabled={busy}><PackagePlus size={16}/> Adicionar</button></form><div className="admin-category-list">{categories.map(c => <span key={c.id}>{c.name}{!c.active && ' (inativa)'}</span>)}</div></section>
    <section className="admin-products"><div className="admin-section-heading"><div><h2>Produtos cadastrados</h2><p>Edite os dados, gerencie as fotos e publique ou oculte os itens.</p></div><button className="button button-outline" onClick={loadData} disabled={busy}><RefreshCw size={15}/> Atualizar</button></div>
      <div className="admin-product-list">{products.map(p => <article className="admin-product-row" key={p.id}><div className="admin-product-thumb">{p.product_images?.[0]?.storage_path ? <img src={storageImageUrl(p.product_images[0].storage_path)} alt=""/> : <ImagePlus size={22}/>}</div><div className="admin-product-copy"><strong>{p.name}</strong><small>{p.categories?.name || 'Sem categoria'} · {p.price_mode === 'quote' ? 'Sob consulta' : formatCurrency(p.price)}</small><span className={p.published ? 'admin-status published' : 'admin-status'}>{p.published ? 'Publicado' : 'Oculto'}</span></div><div className="admin-product-actions"><button className="button button-outline" onClick={() => editProduct(p)} disabled={busy}><Pencil size={15}/> Editar</button><button className="button button-outline" onClick={() => setPublished(p, !p.published)} disabled={busy}>{p.published ? 'Ocultar' : 'Publicar'}</button><button className="admin-delete-button" aria-label={'Excluir ' + p.name} onClick={() => deleteProduct(p)} disabled={busy}><Trash2 size={16}/></button></div></article>)}</div>
      {!products.length && <div className="empty-state"><PackagePlus size={24}/><h3>Nenhum produto cadastrado</h3><p>Use o formulário acima para adicionar os primeiros produtos reais.</p></div>}
    </section>
  </main></>;
}
