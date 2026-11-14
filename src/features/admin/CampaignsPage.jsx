import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { DndContext, PointerSensor, TouchSensor, KeyboardSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, CalendarDays, Eye, GripVertical, Plus, Save, Trash2, X } from "lucide-react";
import Header from "../../components/Header.jsx";
import { isSupabaseConfigured, supabase } from "../../lib/supabase.js";

const THEMES = [
  { value: "black-friday", label: "Black Friday" },
  { value: "natal", label: "Natal" },
  { value: "dia-das-maes", label: "Dia das Mães" },
  { value: "dia-dos-pais", label: "Dia dos Pais" }
];
const emptyForm = {
  name: "", slug: "black-friday", headline: "", subtitle: "",
  starts_at: "", ends_at: "", is_active: false, priority: 0
};
const toLocalInput = value => {
  if (!value) return "";
  const date = new Date(value);
  const pad = number => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const toIso = value => new Date(value).toISOString();

function SortableCampaignProduct({ item, product, onPriceChange, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.product_id });
  return (
    <div ref={setNodeRef} className="campaign-admin-product" style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .55 : 1 }}>
      <button type="button" className="campaign-drag-handle" {...attributes} {...listeners} aria-label={`Reordenar ${product?.name || "produto"}`}><GripVertical size={17}/></button>
      <span className="campaign-admin-product-name">{product?.name || "Produto removido"}</span>
      <label>Preço promo. (R$)<input type="number" min="0" step="0.01" value={item.promo_price ?? ""} onChange={event => onPriceChange(item.product_id, event.target.value)}/></label>
      <button type="button" className="icon-button" onClick={() => onRemove(item.product_id)} aria-label="Remover produto"><X size={16}/></button>
    </div>
  );
}

export default function CampaignsPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(undefined);
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  async function loadData() {
    setLoading(true); setError("");
    const [campaignResult, productResult] = await Promise.all([
      supabase.from("campaigns").select("*,campaign_products(campaign_id,product_id,promo_price,position)").order("created_at", { ascending: false }),
      supabase.from("products").select("id,name,slug,price,price_mode,published").order("name")
    ]);
    if (campaignResult.error) setError(`Falha ao carregar campanhas: ${campaignResult.error.message}`);
    else setCampaigns(campaignResult.data || []);
    if (productResult.error) setError(current => current || `Falha ao carregar produtos: ${productResult.error.message}`);
    else setProducts(productResult.data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!isSupabaseConfigured) { setChecking(false); setLoading(false); return; }
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      const current = data.session || null;
      setSession(current);
      if (!current) { setChecking(false); return; }
      const { data: admin, error: adminError } = await supabase.from("catalog_admins").select("user_id").eq("user_id", current.user.id).maybeSingle();
      if (!alive) return;
      const isAdmin = !adminError && Boolean(admin);
      setAuthorized(isAdmin);
      if (isAdmin) await loadData();
      if (alive) setChecking(false);
    }).catch(() => { if (alive) { setSession(null); setChecking(false); } });
    return () => { alive = false; };
  }, []);

  const filteredProducts = useMemo(() => products.filter(product => product.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))), [products, search]);
  const overlap = useMemo(() => {
    if (!form.starts_at || !form.ends_at) return [];
    const start = new Date(form.starts_at).getTime();
    const end = new Date(form.ends_at).getTime();
    return campaigns.filter(c => c.id !== editingId && start < new Date(c.ends_at).getTime() && end > new Date(c.starts_at).getTime());
  }, [campaigns, form.starts_at, form.ends_at, editingId]);

  function resetForm() { setEditingId(null); setForm(emptyForm); setSelected([]); setError(""); setNotice(""); setPreview(false); }
  function editCampaign(campaign) {
    setEditingId(campaign.id);
    setForm({ name: campaign.name, slug: campaign.slug, headline: campaign.headline, subtitle: campaign.subtitle || "", starts_at: toLocalInput(campaign.starts_at), ends_at: toLocalInput(campaign.ends_at), is_active: campaign.is_active, priority: campaign.priority ?? 0 });
    setSelected([...(campaign.campaign_products || [])].sort((a,b) => a.position - b.position).map(item => ({ product_id: item.product_id, promo_price: item.promo_price })));
    setError(""); setNotice(""); setPreview(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function addProduct(productId) {
    setSelected(items => items.some(item => item.product_id === productId) ? items : [...items, { product_id: productId, promo_price: null }]);
  }
  function updatePrice(productId, value) {
    setSelected(items => items.map(item => item.product_id === productId ? { ...item, promo_price: value === "" ? null : Number(value) } : item));
  }
  function removeProduct(productId) { setSelected(items => items.filter(item => item.product_id !== productId)); }

  async function saveCampaign(event) {
    event.preventDefault(); setError(""); setNotice("");
    if (!form.name.trim() || !form.headline.trim()) { setError("Informe o nome e o título da campanha."); return; }
    if (!form.starts_at || !form.ends_at || new Date(form.ends_at) <= new Date(form.starts_at)) { setError("A data e hora de término devem ser posteriores ao início."); return; }
    if (!THEMES.some(theme => theme.value === form.slug)) { setError("Selecione um tema válido."); return; }
    if (!Number.isInteger(Number(form.priority))) { setError("A prioridade deve ser um número inteiro."); return; }
    if (form.is_active && !selected.some(item => products.some(product => product.id === item.product_id && product.published))) { setError("Adicione pelo menos um produto publicado antes de ativar a campanha."); return; }
    if (selected.some(item => item.promo_price !== null && (!Number.isFinite(Number(item.promo_price)) || Number(item.promo_price) < 0))) { setError("Confira os preços promocionais informados."); return; }
    setBusy(true);
    const payload = { name: form.name.trim(), slug: form.slug, headline: form.headline.trim(), subtitle: form.subtitle.trim(), starts_at: toIso(form.starts_at), ends_at: toIso(form.ends_at), is_active: form.is_active, priority: Number(form.priority) || 0 };
    const result = editingId
      ? await supabase.from("campaigns").update(payload).eq("id", editingId).select("id").single()
      : await supabase.from("campaigns").insert(payload).select("id").single();
    if (result.error || !result.data) { setError(`Não foi possível salvar a campanha: ${result.error?.message || "erro inesperado"}`); setBusy(false); return; }
    const campaignId = result.data.id;
    const removeResult = await supabase.from("campaign_products").delete().eq("campaign_id", campaignId);
    if (removeResult.error) { setError(`Campanha salva, mas não foi possível atualizar os produtos: ${removeResult.error.message}`); setBusy(false); await loadData(); return; }
    if (selected.length) {
      const links = selected.map((item, index) => ({ campaign_id: campaignId, product_id: item.product_id, promo_price: item.promo_price === "" ? null : item.promo_price, position: index }));
      const insertResult = await supabase.from("campaign_products").insert(links);
      if (insertResult.error) { setError(`Campanha salva, mas os produtos não foram vinculados: ${insertResult.error.message}`); setBusy(false); await loadData(); return; }
    }
    setBusy(false); await loadData(); resetForm(); setNotice("Campanha salva com sucesso.");
  }

  async function toggleCampaign(campaign) {
    const linked = campaign.campaign_products || [];
    if (!campaign.is_active && !linked.some(item => products.some(product => product.id === item.product_id && product.published))) { setError("Adicione ao menos um produto publicado antes de ativar esta campanha."); return; }
    setBusy(true); setError("");
    const { error: updateError } = await supabase.from("campaigns").update({ is_active: !campaign.is_active }).eq("id", campaign.id);
    await loadData();
    if (updateError) setError(`Não foi possível alterar o status: ${updateError.message}`);
    else setNotice(campaign.is_active ? "Campanha desativada." : "Campanha ativada.");
    setBusy(false);
  }
  async function deleteCampaign(campaign) {
    if (!window.confirm(`Excluir a campanha "${campaign.name}"? Esta ação não pode ser desfeita.`)) return;
    setBusy(true);
    const { error: deleteError } = await supabase.from("campaigns").delete().eq("id", campaign.id);
    await loadData();
    if (deleteError) setError(`Não foi possível excluir: ${deleteError.message}`);
    else setNotice("Campanha excluída.");
    setBusy(false);
    if (editingId === campaign.id) { resetForm(); if (!deleteError) setNotice("Campanha excluída."); }
  }

  if (!isSupabaseConfigured) return <Navigate to="/adm" replace/>;
  if (checking) return <div className="empty-state">Verificando sessão e permissões...</div>;
  if (!session || !authorized) return <Navigate to="/adm" replace/>;

  const selectedProducts = selected.map(item => ({ item, product: products.find(product => product.id === item.product_id) })).filter(entry => entry.product);

  return (
    <>
      <Header admin/>
      <main className="admin-page campaign-admin-page">
        <div className="admin-title-row">
          <div><span className="eyebrow"><CalendarDays size={14}/> PAINEL RESTRITO</span><h1>Campanhas <em>sazonais.</em></h1><p>Programe vitrines promocionais e temas especiais para o catálogo.</p></div>
          <div className="admin-title-actions"><button className="button button-outline" onClick={() => navigate("/adm/painel")}><ArrowLeft size={16}/> Voltar ao painel</button></div>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        {notice && <div className="admin-success" role="status">{notice}</div>}
        <section className="admin-editor">
          <div className="admin-section-heading"><div><h2>{editingId ? "Editar campanha" : "Nova campanha"}</h2><p>Escolha o tema, o período e os produtos que serão exibidos abaixo do destaque principal.</p></div>{editingId && <button className="button button-outline" type="button" onClick={resetForm}><X size={16}/> Cancelar</button>}</div>
          <form className="campaign-form" onSubmit={saveCampaign}>
            <div className="campaign-form-grid">
              <label>Nome da campanha<input value={form.name} onChange={e => setForm({...form, name:e.target.value})} required placeholder="Ex.: Black Friday CAN"/></label>
              <label>Tema visual<select value={form.slug} onChange={e => setForm({...form, slug:e.target.value})}>{THEMES.map(theme => <option key={theme.value} value={theme.value}>{theme.label}</option>)}</select></label>
              <label className="campaign-form-wide">Título principal<input value={form.headline} onChange={e => setForm({...form, headline:e.target.value})} required maxLength={160} placeholder="Ex.: Ofertas especiais por tempo limitado"/></label>
              <label className="campaign-form-wide">Subtítulo<textarea value={form.subtitle} onChange={e => setForm({...form, subtitle:e.target.value})} rows={2} placeholder="Conte um pouco sobre esta campanha"/></label>
              <label>Início<input type="datetime-local" value={form.starts_at} onChange={e => setForm({...form, starts_at:e.target.value})} required/></label>
              <label>Término<input type="datetime-local" value={form.ends_at} onChange={e => setForm({...form, ends_at:e.target.value})} required/></label>
              <label>Prioridade<input type="number" step="1" value={form.priority} onChange={e => setForm({...form, priority:e.target.value})}/></label>
              <label className="campaign-active-toggle"><input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active:e.target.checked})}/> Campanha ativa</label>
            </div>
            {overlap.length > 0 && <div className="campaign-warning" role="status">Atenção: este período se sobrepõe a {overlap.map(item => item.name).join(", ")}. A campanha com maior prioridade será exibida.</div>}
            <div className="campaign-products-picker">
              <div className="admin-section-heading"><div><h3>Produtos da campanha</h3><p>Somente produtos publicados podem ser selecionados. Arraste para definir a ordem.</p></div><span>{selected.length} selecionado(s)</span></div>
              <input className="campaign-product-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto para adicionar..."/>
              <div className="campaign-product-options">
                {filteredProducts.map(product => <button type="button" key={product.id} className={selected.some(item => item.product_id === product.id) ? "selected" : ""} onClick={() => addProduct(product.id)} disabled={!product.published || selected.some(item => item.product_id === product.id)}><Plus size={14}/>{product.name}{!product.published ? " · Não publicado" : ""}</button>)}
                {!filteredProducts.length && <p>Nenhum produto publicado encontrado.</p>}
              </div>
              {selectedProducts.length > 0 && <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({active,over}) => { if (!over || active.id === over.id) return; setSelected(items => { const oldIndex=items.findIndex(item=>item.product_id===active.id); const newIndex=items.findIndex(item=>item.product_id===over.id); return arrayMove(items,oldIndex,newIndex); }); }}>
                <SortableContext items={selected.map(item => item.product_id)} strategy={verticalListSortingStrategy}>
                  <div className="campaign-selected-list">{selectedProducts.map(({item,product}) => <SortableCampaignProduct key={item.product_id} item={item} product={product} onPriceChange={updatePrice} onRemove={removeProduct}/>)}</div>
                </SortableContext>
              </DndContext>}
            </div>
            <div className="campaign-form-actions"><button className="button button-outline" type="button" onClick={() => setPreview(value => !value)}><Eye size={16}/>{preview ? "Fechar prévia" : "Pré-visualizar tema"}</button><button className="button button-dark" type="submit" disabled={busy}><Save size={16}/>{busy ? "Salvando..." : "Salvar campanha"}</button></div>
          </form>
          {preview && <div className="campaign-preview" data-theme={form.slug}><span>PRÉVIA DO TEMA · {THEMES.find(theme => theme.value === form.slug)?.label}</span><h2>{form.headline || "Título da campanha"}</h2><p>{form.subtitle || "O subtítulo da campanha aparecerá aqui."}</p><button type="button">Exemplo de botão</button></div>}
        </section>
        <section className="admin-editor">
          <div className="admin-section-heading"><div><h2>Campanhas cadastradas</h2><p>Campanhas fora do período não são exibidas no catálogo, mesmo que estejam ativas.</p></div></div>
          {loading ? <div className="empty-state">Carregando campanhas...</div> : campaigns.length === 0 ? <div className="empty-state">Nenhuma campanha cadastrada ainda.</div> : <div className="campaign-list">{campaigns.map(campaign => <article className="campaign-list-item" key={campaign.id}><div><span className="campaign-list-theme">{THEMES.find(theme => theme.value === campaign.slug)?.label || campaign.slug}</span><h3>{campaign.name}</h3><p>{new Date(campaign.starts_at).toLocaleString("pt-BR")} até {new Date(campaign.ends_at).toLocaleString("pt-BR")}</p><small>{campaign.campaign_products?.length || 0} produto(s) · Prioridade {campaign.priority}</small></div><div className="campaign-list-actions"><span className={campaign.is_active ? "campaign-status active" : "campaign-status"}>{campaign.is_active ? "Ativa" : "Inativa"}</span><button type="button" className="button button-outline" onClick={() => editCampaign(campaign)}>Editar</button><button type="button" className="button button-outline" disabled={busy} onClick={() => toggleCampaign(campaign)}>{campaign.is_active ? "Desativar" : "Ativar"}</button><button type="button" className="icon-button danger" onClick={() => deleteCampaign(campaign)} aria-label="Excluir campanha"><Trash2 size={16}/></button></div></article>)}</div>}
        </section>
      </main>
    </>
  );
}
