import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ExternalLink, Link2, LogOut, RefreshCw, Search, Store, X } from "lucide-react";
import Header from "../../components/Header.jsx";
import { isSupabaseConfigured, supabase } from "../../lib/supabase.js";
import { getInfinitePayUrl, validateInfinitePayUrl } from "../../utils/infinitePay.js";

export default function InfinitePayPage() {
  const [session, setSession] = useState(undefined);
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [products, setProducts] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const navigate = useNavigate();

  async function loadProducts() {
    setError("");
    const { data, error: loadError } = await supabase
      .from("products")
      .select("id,name,slug,published,availability,infinitepay_product_url")
      .order("name");
    if (loadError) {
      setError("Não foi possível carregar os produtos. Confirme se a migration da InfinitePay já foi aplicada: " + loadError.message);
      return;
    }
    const rows = data || [];
    setProducts(rows);
    setDrafts(Object.fromEntries(rows.map(product => [product.id, product.infinitepay_product_url || ""])));
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let alive = true;
    supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (!alive) return;
      const current = sessionError ? null : data.session;
      setSession(current);
      if (!current) { setChecking(false); return; }
      const { data: admin, error: adminError } = await supabase
        .from("catalog_admins").select("user_id").eq("user_id", current.user.id).maybeSingle();
      if (!alive) return;
      const allowed = !adminError && Boolean(admin);
      setAuthorized(allowed);
      if (allowed) await loadProducts();
      if (alive) setChecking(false);
    }).catch(() => { if (alive) { setSession(null); setChecking(false); } });
    return () => { alive = false; };
  }, []);

  const linkedCount = products.filter(product => getInfinitePayUrl(product.infinitepay_product_url)).length;
  const filteredProducts = useMemo(() => products.filter(product => {
    const matchesText = (product.name + " " + product.slug).toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"));
    const linked = Boolean(getInfinitePayUrl(drafts[product.id]));
    return matchesText && (filter === "all" || (filter === "linked" ? linked : !linked));
  }), [products, drafts, query, filter]);

  async function saveLink(product) {
    const rawUrl = (drafts[product.id] || "").trim();
    const validation = validateInfinitePayUrl(rawUrl);
    if (!validation.valid) { setError(validation.message); setNotice(""); return; }
    setBusyId(product.id); setError(""); setNotice("");
    const { error: saveError } = await supabase
      .from("products")
      .update({ infinitepay_product_url: validation.value || null })
      .eq("id", product.id);
    if (saveError) {
      setError("Não foi possível salvar o link de " + product.name + ": " + saveError.message);
      setBusyId(null);
      return;
    }
    setProducts(current => current.map(item => item.id === product.id ? { ...item, infinitepay_product_url: validation.value } : item));
    setDrafts(current => ({ ...current, [product.id]: validation.value || "" }));
    setNotice(validation.value ? "Link da InfinitePay salvo para " + product.name + "." : "Link removido de " + product.name + ". O botão de checkout ficará oculto.");
    setBusyId(null);
  }

  async function logout() { await supabase.auth.signOut(); navigate("/adm"); }
  if (!isSupabaseConfigured) return <Navigate to="/adm" replace />;
  if (checking || session === undefined) return <div className="empty-state">Verificando sessão e permissões...</div>;
  if (!session || !authorized) return <Navigate to="/adm" replace />;

  return <>
    <Header admin />
    <main className="admin-main infinitepay-admin">
      <div className="admin-title-row">
        <div>
          <button className="sales-back" onClick={() => navigate("/adm/painel")}><ArrowLeft size={15}/> Painel administrativo</button>
          <span className="eyebrow"><Store size={14}/> CAN GROUP / CANAIS DE VENDA</span>
          <h1>Integração<br/><em>InfinitePay.</em></h1>
          <p>Vincule o link individual da Loja Online aos produtos do catálogo CAN.</p>
        </div>
        <div className="admin-title-actions">
          <button className="button button-outline" onClick={loadProducts}><RefreshCw size={15}/> Atualizar</button>
          <button className="button button-outline" onClick={logout}><LogOut size={16}/> Sair</button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><span>Produtos no CAN</span><strong>{products.length}</strong></div>
        <div className="stat-card"><span>Vinculados à InfinitePay</span><strong>{linkedCount}</strong></div>
        <div className="stat-card"><span>Pendentes de vínculo</span><strong>{products.length - linkedCount}</strong></div>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
      {notice && <div className="admin-success" role="status">{notice}</div>}

      <section className="admin-products infinitepay-list">
        <div className="admin-section-heading">
          <div><h2>Vincular produtos</h2><p>Cadastre os produtos na InfinitePay aos poucos. Sem link, o botão de checkout não aparece no site.</p></div>
        </div>
        <div className="infinitepay-toolbar">
          <label className="publication-search"><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar produto..."/></label>
          <div className="infinitepay-filters">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todos ({products.length})</button>
            <button className={filter === "linked" ? "active" : ""} onClick={() => setFilter("linked")}>Vinculados ({linkedCount})</button>
            <button className={filter === "pending" ? "active" : ""} onClick={() => setFilter("pending")}>Pendentes ({products.length - linkedCount})</button>
          </div>
        </div>
        <div className="infinitepay-product-list">
          {filteredProducts.map(product => {
            const savedUrl = getInfinitePayUrl(product.infinitepay_product_url);
            const draftUrl = drafts[product.id] || "";
            const changed = draftUrl.trim() !== (product.infinitepay_product_url || "");
            return <article className="infinitepay-product-row" key={product.id}>
              <div className="infinitepay-product-info">
                <strong>{product.name}</strong>
                <small>{product.published ? "Publicado" : "Oculto"} · {product.availability === "unavailable" ? "Indisponível" : product.availability === "made_to_order" ? "Sob encomenda" : "Disponível"}</small>
                <span className={savedUrl ? "infinitepay-status linked" : "infinitepay-status"}>{savedUrl ? <><Check size={13}/> Link cadastrado</> : <><Link2 size={13}/> Aguardando link</>}</span>
              </div>
              <div className="infinitepay-link-editor">
                <label htmlFor={"infinitepay-" + product.id}>Link individual da InfinitePay</label>
                <input id={"infinitepay-" + product.id} type="url" inputMode="url" placeholder="https://infinitepay.io/..." value={draftUrl} onChange={event => setDrafts(current => ({ ...current, [product.id]: event.target.value }))}/>
                <div className="infinitepay-row-actions">
                  {savedUrl && <a href={savedUrl} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Abrir link</a>}
                  {savedUrl && <button type="button" className="infinitepay-clear" onClick={() => setDrafts(current => ({ ...current, [product.id]: "" }))}><X size={14}/> Limpar</button>}
                  <button type="button" className="infinitepay-save" disabled={busyId === product.id || !changed} onClick={() => saveLink(product)}>{busyId === product.id ? "Salvando..." : "Salvar vínculo"}</button>
                </div>
              </div>
            </article>;
          })}
          {!filteredProducts.length && <div className="empty-state"><h3>Nenhum produto encontrado</h3><p>Altere a busca ou o filtro selecionado.</p></div>}
        </div>
      </section>
    </main>
  </>;
}
