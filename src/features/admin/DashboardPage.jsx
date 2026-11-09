import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, Calculator, ChartNoAxesCombined, ImagePlus, LogOut, PackagePlus, Pencil, RefreshCw, Save, ShieldCheck, Star, Trash2, X } from 'lucide-react';
import Header from '../../components/Header.jsx';
import { isSupabaseConfigured, supabase } from '../../lib/supabase.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { storageImageUrl } from '../../utils/storageImageUrl.js';

const blankProduct = {
  name: '', slug: '', category_id: '', description: '', price_mode: 'fixed', price: '',
  availability: 'available', stock_quantity: '', customization_enabled: false,
  featured: false, published: false, available_colors: '', makerworld_url: '', filament_weight_g: '', print_time_hours: '', print_time_minutes: ''
};
const slugify = (value) => value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const getProductPrintDetails = (product) => {
  const details = product?.product_print_details;
  return Array.isArray(details) ? details[0] || null : details || null;
};

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
  const [existingMedia, setExistingMedia] = useState([]);
  const [draggedFeaturedId, setDraggedFeaturedId] = useState(null);
  const [dragOverFeaturedId, setDragOverFeaturedId] = useState(null);
  const [categoryName, setCategoryName] = useState('');
  const navigate = useNavigate();

  async function loadData() {
    const [p, c] = await Promise.all([
      supabase.from('products').select('*, categories(name), product_images(*), product_print_details(*)').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('sort_order')
    ]);
    if (p.error) setError(`Falha ao carregar produtos: ${p.error.message}`);
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
  function resetForm() { setEditingId(null); setForm(blankProduct); setFiles([]); setExistingMedia([]); setError(''); setNotice(''); }
  function editProduct(product) {
    const printDetails = getProductPrintDetails(product);
    setEditingId(product.id);
    setForm({
      name: product.name || '', slug: product.slug || '', category_id: product.category_id || '',
      description: product.description || '', price_mode: product.price_mode || 'fixed',
      price: product.price ?? '', availability: product.availability || 'available',
      stock_quantity: product.stock_quantity ?? '', customization_enabled: !!product.customization_enabled,
      featured: !!product.featured, published: !!product.published,
      available_colors: Array.isArray(product.available_colors) ? product.available_colors.join(', ') : '',
      makerworld_url: printDetails?.makerworld_url || '',
      filament_weight_g: printDetails?.filament_weight_g ?? '',
      print_time_hours: printDetails?.print_time_hours ?? '',
      print_time_minutes: printDetails?.print_time_minutes ?? ''
    });
    setFiles([]);
    setExistingMedia([...(product.product_images || [])].sort((a,b) => (a.sort_order || 0) - (b.sort_order || 0)));
    setError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function removeProductMedia(media) {
    const label = media.media_type === 'video' ? 'vídeo' : 'imagem';
    if (!window.confirm(`Deseja realmente remover esta ${label} do produto?`)) return;
    setBusy(true); setError(''); setNotice('');
    const { error: deleteRowError } = await supabase
      .from('product_images')
      .delete()
      .eq('id', media.id);
    if (deleteRowError) {
      setError(`Não foi possível remover a mídia: ${deleteRowError.message}`);
      setBusy(false);
      return;
    }
    const { error: storageError } = await supabase.storage
      .from('product-images')
      .remove([media.storage_path]);
    setExistingMedia(items => items.filter(item => item.id !== media.id));
    if (storageError) {
      setError(`A mídia saiu do produto, mas o arquivo não foi removido do armazenamento: ${storageError.message}`);
    } else {
      setNotice(`${label === 'vídeo' ? 'Vídeo' : 'Imagem'} removida com sucesso.`);
    }
    await loadData();
    setBusy(false);
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
      customization_enabled: form.customization_enabled, featured: form.featured, published: form.published,
      available_colors: form.available_colors.split(',').map(color => color.trim()).filter(Boolean)
    };
    const makerworldUrl = form.makerworld_url.trim();
    if (makerworldUrl && !makerworldUrl.startsWith('https://') && !makerworldUrl.startsWith('http://')) {
      setError('O link do MakerWorld deve começar com https:// ou http://.'); setBusy(false); return;
    }
    const filamentWeight = form.filament_weight_g === '' ? null : Number(form.filament_weight_g);
    if (filamentWeight !== null && (!Number.isFinite(filamentWeight) || filamentWeight < 0)) {
      setError('Informe uma quantidade de gramas válida.'); setBusy(false); return;
    }
    const printHours = form.print_time_hours === '' ? null : Number(form.print_time_hours);
    const printMinutes = form.print_time_minutes === '' ? null : Number(form.print_time_minutes);
    if ((printHours !== null && (!Number.isInteger(printHours) || printHours < 0)) || (printMinutes !== null && (!Number.isInteger(printMinutes) || printMinutes < 0 || printMinutes > 59))) {
      setError('Informe o tempo em horas inteiras e minutos entre 0 e 59.'); setBusy(false); return;
    }
    const hasPrintTime = printHours !== null || printMinutes !== null;
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
    const invalidFile = files.find(file => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      const isImage = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || ['jpg','jpeg','png','webp','avif'].includes(extension);
      const isVideo = ['video/mp4', 'video/webm'].includes(file.type) || ['mp4','webm'].includes(extension);
      return (!isImage && !isVideo) || file.size > (isVideo ? 200 : 5) * 1024 * 1024;
    });
    if (invalidFile) {
      setError('Arquivo inválido. Use imagens de até 5 MB ou vídeos MP4/WebM de até 200 MB.');
      setBusy(false); return;
    }
    const productId = result.data.id;
    const printDetails = await supabase.from('product_print_details').upsert({
      product_id: productId,
      makerworld_url: makerworldUrl,
      filament_weight_g: filamentWeight,
      print_time_hours: hasPrintTime ? (printHours ?? 0) : null,
      print_time_minutes: hasPrintTime ? (printMinutes ?? 0) : null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'product_id' });
    if (printDetails.error) {
      setError(`Produto salvo, mas os dados internos de impressão falharam: ${printDetails.error.message}`);
      setBusy(false); await loadData(); return;
    }
    const { data: lastMedia } = await supabase
      .from('product_images')
      .select('sort_order')
      .eq('product_id', productId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    let nextSortOrder = Number.isInteger(lastMedia?.sort_order) ? lastMedia.sort_order + 1 : 0;

    for (const file of files) {
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
      const path = productId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + safeName;
      const extension = file.name.split('.').pop()?.toLowerCase();
      const mediaType = file.type.startsWith('video/') || ['mp4','webm'].includes(extension) ? 'video' : 'image';
      const contentType = file.type || (extension === 'mp4' ? 'video/mp4' : extension === 'webm' ? 'video/webm' : 'application/octet-stream');
      const upload = await supabase.storage.from('product-images').upload(path, file, { contentType, upsert: false });
      if (upload.error) { setError(`Produto salvo, mas o envio de ${file.name} falhou: ${upload.error.message}`); setBusy(false); await loadData(); return; }
      const imageRow = await supabase.from('product_images').insert({ product_id: productId, storage_path: path, alt_text: payload.name, media_type: mediaType, sort_order: nextSortOrder });
      if (imageRow.error) {
        await supabase.storage.from('product-images').remove([path]);
        setError(`Produto salvo, mas não foi possível registrar uma mídia: ${imageRow.error.message}`);
        setBusy(false);
        await loadData();
        return;
      }
      nextSortOrder += 1;
    }
    await loadData();
    setBusy(false);
    resetForm();
    setNotice(editingId ? 'Produto atualizado com sucesso.' : 'Produto cadastrado com sucesso.');
  }
  async function setFeatured(product, featured) {
    setBusy(true); setError(""); setNotice("");
    let featuredOrder = null;
    if (featured) {
      const current = products.filter(item => item.featured);
      featuredOrder = current.reduce((max,item) => Math.max(max,Number(item.featured_order)||0),0)+1;
    }
    const { error: err } = await supabase.from("products").update({ featured, featured_order: featuredOrder }).eq("id", product.id);
    if (err) setError("Não foi possível atualizar o destaque.");
    else { await loadData(); setNotice(featured ? "Produto adicionado ao final dos destaques." : "Produto removido dos destaques."); }
    setBusy(false);
  }
  async function moveFeatured(product, direction) {
    const ordered = products.filter(item => item.featured).sort((a,b) => (Number(a.featured_order)||999999)-(Number(b.featured_order)||999999));
    const index = ordered.findIndex(item => item.id === product.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    setBusy(true); setError(""); setNotice("");
    const first = ordered[index], second = ordered[target];
    const firstOrder = Number(first.featured_order)||index+1;
    const secondOrder = Number(second.featured_order)||target+1;
    const a = await supabase.from("products").update({featured_order:secondOrder}).eq("id",first.id);
    const b = await supabase.from("products").update({featured_order:firstOrder}).eq("id",second.id);
    if(a.error||b.error) setError("Não foi possível alterar a ordem dos destaques.");
    else { await loadData(); setNotice("Ordem dos destaques atualizada."); }
    setBusy(false);
  }
  async function reorderFeatured(draggedId, targetId) {
    if (!draggedId || !targetId || draggedId === targetId) return;
    const ordered = products.filter(item => item.featured).sort((a,b) => (Number(a.featured_order)||999999)-(Number(b.featured_order)||999999));
    const from = ordered.findIndex(item => item.id === draggedId);
    const to = ordered.findIndex(item => item.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...ordered];
    const [moved] = next.splice(from,1);
    next.splice(to,0,moved);
    setBusy(true); setError(''); setNotice('');
    for (let index=0; index<next.length; index++) {
      const {error: updateError} = await supabase.from('products').update({featured_order:index+1}).eq('id',next[index].id);
      if (updateError) {
        setError('Não foi possível salvar a nova ordem dos destaques: '+updateError.message);
        setBusy(false);
        await loadData();
        return;
      }
    }
    await loadData();
    setNotice('Ordem dos destaques atualizada.');
    setBusy(false);
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
    <div className="admin-title-row"><div><span className="eyebrow"><ShieldCheck size={14}/> PAINEL RESTRITO</span><h1>Seu catálogo,<br/><em>sob controle.</em></h1><p>Gerencie os produtos que aparecem na vitrine CAN Group.</p></div><div className="admin-title-actions"><button className="button button-dark" onClick={() => navigate("/adm/vendas")}><ChartNoAxesCombined size={16}/> Controle de vendas</button><button className="button button-outline" onClick={() => navigate("/adm/orcamento-3d")}><Calculator size={16}/> Orçamento 3D</button><button className="button button-outline" onClick={logout}><LogOut size={16}/> Sair</button></div></div>
    <div className="stats-grid"><div className="stat-card"><span>Produtos cadastrados</span><strong>{products.length}</strong></div><div className="stat-card"><span>Publicados</span><strong>{products.filter(p => p.published).length}</strong></div><div className="stat-card"><span>Categorias ativas</span><strong>{categories.filter(c => c.active).length}</strong></div></div>
    {error && <div className="form-error" role="alert">{error}</div>}{notice && <div className="admin-success" role="status">{notice}</div>}
    <section className="admin-editor">
      <div className="admin-section-heading"><div><h2>{editingId ? 'Editar produto' : 'Cadastrar produto'}</h2><p>Use fotos reais dos itens da CAN Group. Imagens de até 5 MB e vídeos de até 200 MB.</p></div>{editingId && <button className="button button-outline" onClick={resetForm}><X size={16}/> Cancelar edição</button>}</div>
      <form className="product-form" onSubmit={saveProduct}>
        <div className="admin-form-grid">
          <label>Nome do produto<input required maxLength={140} value={form.name} onChange={e => setForm({...form, name:e.target.value, slug: editingId ? form.slug : slugify(e.target.value)})} placeholder="Ex.: Chaveiro personalizado"/></label>
          <label>Slug / endereço<input required value={form.slug} onChange={e => setForm({...form, slug:slugify(e.target.value)})} placeholder="chaveiro-personalizado"/></label>
          <label>Categoria<select value={form.category_id} onChange={e => setForm({...form, category_id:e.target.value})}><option value="">Sem categoria</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Preço<select value={form.price_mode} onChange={e => setForm({...form, price_mode:e.target.value, price:e.target.value === 'quote' ? '' : form.price})}><option value="fixed">Preço fixo</option><option value="quote">Sob consulta</option></select></label>
          {form.price_mode === 'fixed' && <label>Preço (R$)<input type="number" min="0" step="0.01" required value={form.price} onChange={e => setForm({...form, price:e.target.value})} placeholder="8,00"/></label>}
          <label>Disponibilidade<select value={form.availability} onChange={e => setForm({...form, availability:e.target.value})}><option value="available">Disponível</option><option value="made_to_order">Sob encomenda</option><option value="unavailable">Indisponível</option></select></label>
          <label>Quantidade em estoque (opcional)<input type="number" min="0" step="1" value={form.stock_quantity} onChange={e => setForm({...form, stock_quantity:e.target.value})} placeholder="Deixe vazio se não controlar"/></label>
          <label className="admin-file-field"><span><ImagePlus size={17}/> Fotos e vídeo do produto</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm" multiple onChange={e => setFiles(Array.from(e.target.files || []))}/><small>{files.length ? files.map(f => f.name).join(', ') : 'Selecione várias imagens (até 5 MB cada) e/ou vídeos MP4/WebM (até 200 MB cada). Novos arquivos serão adicionados à galeria.'}</small></label>
          {editingId && existingMedia.length > 0 && <div className="admin-existing-media"><strong>Mídias cadastradas</strong><div className="admin-existing-media-grid">{existingMedia.map(media => <div className="admin-existing-media-item" key={media.id}>{media.media_type === 'video' ? <video src={storageImageUrl(media.storage_path)} muted playsInline /> : <img src={storageImageUrl(media.storage_path)} alt={media.alt_text || form.name} /> }<span>{media.media_type === 'video' ? 'Vídeo' : 'Imagem'}</span><button type="button" className="admin-media-remove" onClick={() => removeProductMedia(media)} disabled={busy} aria-label="Remover mídia"><Trash2 size={14}/> Remover</button></div>)}</div></div>}
        </div>
        <label>Descrição<textarea rows="4" maxLength={3000} value={form.description} onChange={e => setForm({...form, description:e.target.value})} placeholder="Descreva materiais, dimensões e opções de personalização."/></label>
        <label>Cores disponíveis<input value={form.available_colors} onChange={e => setForm({...form, available_colors:e.target.value})} placeholder="Ex.: Preto, Branco, Verde oliva, Rosa"/><small>Separe as cores por vírgula. Elas serão exibidas no anúncio.</small></label>
        <section className="admin-print-details">
          <div><h3>Dados internos de impressão 3D</h3><p>Visíveis somente para administradores; não aparecem no catálogo público.</p></div>
          <div className="admin-form-grid">
            <label>Link do MakerWorld<input type="url" value={form.makerworld_url} onChange={e => setForm({...form, makerworld_url:e.target.value})} placeholder="https://makerworld.com/..." /></label>
            <label>Peso da peça (gramas)<input type="number" min="0" step="0.01" value={form.filament_weight_g} onChange={e => setForm({...form, filament_weight_g:e.target.value})} placeholder="Ex.: 24.5" /></label>
          </div>
          <div className="admin-form-grid admin-print-time-grid">
            <label>Tempo de impressão — horas<input type="number" min="0" step="1" value={form.print_time_hours} onChange={e => setForm({...form, print_time_hours:e.target.value})} placeholder="Ex.: 2" /></label>
            <label>Tempo de impressão — minutos<input type="number" min="0" max="59" step="1" value={form.print_time_minutes} onChange={e => setForm({...form, print_time_minutes:e.target.value})} placeholder="Ex.: 30" /></label>
          </div>
        </section>
        <div className="admin-checkboxes"><label><input type="checkbox" checked={form.customization_enabled} onChange={e => setForm({...form, customization_enabled:e.target.checked})}/> Permite personalização</label><label><input type="checkbox" checked={form.featured} onChange={e => setForm({...form, featured:e.target.checked})}/> Destacar na vitrine</label><label><input type="checkbox" checked={form.published} onChange={e => setForm({...form, published:e.target.checked})}/> Publicar na vitrine</label></div>
        <div className="admin-form-actions"><button className="button button-dark" disabled={busy}><Save size={16}/>{busy ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar produto'}</button><button type="button" className="button button-outline" onClick={resetForm} disabled={busy}>Limpar formulário</button></div>
      </form>
    </section>
    <section className="admin-categories"><div><h2>Categorias</h2><p>Crie categorias para organizar a vitrine.</p></div><form onSubmit={addCategory}><input value={categoryName} onChange={e => setCategoryName(e.target.value)} required maxLength={80} placeholder="Nova categoria"/><button className="button button-dark" disabled={busy}><PackagePlus size={16}/> Adicionar</button></form><div className="admin-category-list">{categories.map(c => <span key={c.id}>{c.name}{!c.active && ' (inativa)'}</span>)}</div></section>
    <section className="admin-products"><div className="admin-section-heading"><div><h2>Produtos cadastrados</h2><p>Edite os dados, gerencie as fotos e publique ou oculte os itens. Nos destaques, arraste os produtos para definir a ordem do carrossel.</p></div><button className="button button-outline" onClick={loadData} disabled={busy}><RefreshCw size={15}/> Atualizar</button></div>
      <div className="admin-product-list">{[...products].sort((a,b) => a.featured !== b.featured ? (a.featured ? -1 : 1) : (Number(a.featured_order)||999999)-(Number(b.featured_order)||999999)).map(p => <article className={p.featured ? "admin-product-row featured-draggable-row" + (dragOverFeaturedId===p.id ? " is-drag-over" : "") : "admin-product-row"} key={p.id}
        onDragOver={event=>{if(!draggedFeaturedId||!p.featured)return;event.preventDefault();event.dataTransfer.dropEffect='move';setDragOverFeaturedId(p.id);}}
        onDrop={event=>{event.preventDefault();const source=event.dataTransfer.getData('text/plain')||draggedFeaturedId;setDragOverFeaturedId(null);setDraggedFeaturedId(null);reorderFeatured(source,p.id);}}
        onDragEnd={()=>{setDraggedFeaturedId(null);setDragOverFeaturedId(null);}}
      >{p.featured && <button type="button" className="featured-drag-grip" draggable={!busy} title="Arraste para reordenar" aria-label="Arraste para reordenar" onDragStart={event=>{event.stopPropagation();setDraggedFeaturedId(p.id);event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",p.id);}} onDragEnd={()=>{setDraggedFeaturedId(null);setDragOverFeaturedId(null);}}>⠿</button>}<div className="admin-product-thumb">{p.product_images?.[0]?.storage_path ? <img src={storageImageUrl(p.product_images[0].storage_path)} alt=""/> : <ImagePlus size={22}/>}</div>}<div className="admin-product-copy"><strong>{p.name}</strong><small>{p.categories?.name || 'Sem categoria'} · {p.price_mode === 'quote' ? 'Sob consulta' : formatCurrency(p.price)}</small><span className={p.published ? 'admin-status published' : 'admin-status'}>{p.published ? 'Publicado' : 'Oculto'}</span>{(getProductPrintDetails(p)?.makerworld_url || getProductPrintDetails(p)?.filament_weight_g != null || getProductPrintDetails(p)?.print_time_hours != null || getProductPrintDetails(p)?.print_time_minutes != null) && <div className="admin-product-print-summary">{getProductPrintDetails(p)?.makerworld_url && <a href={getProductPrintDetails(p).makerworld_url} target="_blank" rel="noreferrer">Abrir MakerWorld</a>}{getProductPrintDetails(p)?.filament_weight_g != null && <span><strong>{Number(getProductPrintDetails(p).filament_weight_g).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} g</strong> de filamento</span>}{(getProductPrintDetails(p)?.print_time_hours != null || getProductPrintDetails(p)?.print_time_minutes != null) && <span><strong>{Number(getProductPrintDetails(p)?.print_time_hours || 0)}h {String(Number(getProductPrintDetails(p)?.print_time_minutes || 0)).padStart(2, '0')}min</strong> de impressão</span>}</div>}</div><div className="admin-product-actions"><button className="button button-outline" onClick={() => editProduct(p)} disabled={busy}><Pencil size={15}/> Editar</button><button className="button button-outline" onClick={() => setPublished(p, !p.published)} disabled={busy}>{p.published ? 'Ocultar' : 'Publicar'}</button>{p.featured && <><button className="button button-outline featured-order-button" title="Mover para cima" aria-label="Mover destaque para cima" onClick={() => moveFeatured(p,-1)} disabled={busy || products.filter(item=>item.featured).sort((a,b)=>(Number(a.featured_order)||999999)-(Number(b.featured_order)||999999))[0]?.id===p.id}><ArrowUp size={14}/></button><button className="button button-outline featured-order-button" title="Mover para baixo" aria-label="Mover destaque para baixo" onClick={() => moveFeatured(p,1)} disabled={busy || products.filter(item=>item.featured).sort((a,b)=>(Number(a.featured_order)||999999)-(Number(b.featured_order)||999999)).at(-1)?.id===p.id}><ArrowDown size={14}/></button></>}<button className={p.featured ? "button button-featured is-featured" : "button button-featured"} onClick={() => setFeatured(p, !p.featured)} disabled={busy} aria-pressed={!!p.featured}><Star size={14} fill={p.featured ? "currentColor" : "none"}/>{p.featured ? "Em destaque" : "Destacar"}</button><button className="admin-delete-button" aria-label={'Excluir ' + p.name} onClick={() => deleteProduct(p)} disabled={busy}><Trash2 size={16}/></button></div></article>)}</div>
      {!products.length && <div className="empty-state"><PackagePlus size={24}/><h3>Nenhum produto cadastrado</h3><p>Use o formulário acima para adicionar os primeiros produtos reais.</p></div>}
    </section>
  </main></>;
}
