import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Search,
  Sparkles,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Star,
  SlidersHorizontal,
  X,
  ArrowDownWideNarrow,
} from "lucide-react";
import Header from "../../components/Header.jsx";
import Footer from "../../components/Footer.jsx";
import ProductCard from "../../components/ProductCard.jsx";
import { isSupabaseConfigured, supabase } from "../../lib/supabase.js";
import imagemHero from "../../assets/Logo-Hero.png";

export default function CatalogPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState("featured");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [customOnly, setCustomOnly] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [salesRank, setSalesRank] = useState({});
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState("");
  const featuredTrackRef = useRef(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    async function load() {
      setLoading(true);
      const [productResult, categoryResult] = await Promise.all([
        supabase
          .from("products")
          .select("*, categories(name), product_images(*)")
          .eq("published", true)
          .order("featured", { ascending: false })
          .order("featured_order", { ascending: true, nullsFirst: false })
          .order("name"),
        supabase
          .from("categories")
          .select("id,name,slug")
          .eq("active", true)
          .order("sort_order"),
      ]);
      if (!active) return;
      if (productResult.error)
        setError(
          "Não foi possível carregar os produtos. Confira a configuração do Supabase.",
        );
      else setProducts(productResult.data || []);
      if (!categoryResult.error) setCategories(categoryResult.data || []);
      const { data: salesData } = await supabase.from("sale_items").select("product_id,quantity");
      if (active && salesData) {
        const totals = {};
        salesData.forEach(item => { if (item.product_id) totals[item.product_id] = (totals[item.product_id] || 0) + Number(item.quantity || 0); });
        setSalesRank(totals);
      }
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const featuredProducts = useMemo(
    () => products.filter((p) => p.featured && p.availability !== "unavailable"),
    [products],
  );

  const scrollFeatured = (direction) => {
    if (!featuredTrackRef.current) return;
    featuredTrackRef.current.scrollBy({ left: direction * featuredTrackRef.current.clientWidth * 0.82, behavior: "smooth" });
  };

  const visibleProducts = useMemo(() => {
    const filtered = products.filter((p) => {
      const text = `${p.name || ""} ${p.description || ""} ${p.categories?.name || ""}`.toLocaleLowerCase("pt-BR");
      return text.includes(query.trim().toLocaleLowerCase("pt-BR")) &&
        (category === "all" || p.category_id === category) &&
        (availabilityFilter === "all" || p.availability === availabilityFilter) &&
        (!customOnly || p.customization_enabled) &&
        p.availability !== "unavailable";
    });
    return filtered.sort((a,b) => {
      if (sortBy === "price_asc") return Number(a.price || 0) - Number(b.price || 0);
      if (sortBy === "price_desc") return Number(b.price || 0) - Number(a.price || 0);
      if (sortBy === "name") return a.name.localeCompare(b.name, "pt-BR");
      if (sortBy === "newest") return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (sortBy === "best_selling") return (salesRank[b.id] || 0) - (salesRank[a.id] || 0);
      return Number(b.featured) - Number(a.featured) || (Number(a.featured_order) || 999999) - (Number(b.featured_order) || 999999);
    });
  }, [products, query, category, availabilityFilter, customOnly, sortBy, salesRank]);

  const newProducts = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return products.filter(p => p.availability !== "unavailable" && p.created_at && new Date(p.created_at).getTime() >= cutoff)
      .sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);
  }, [products]);
  const customizedProducts = useMemo(() => products.filter(p => p.customization_enabled && p.availability !== "unavailable").slice(0, 8), [products]);
  const bestSellingProducts = useMemo(() => products.filter(p => (salesRank[p.id] || 0) > 0 && p.availability !== "unavailable")
    .sort((a,b) => (salesRank[b.id] || 0) - (salesRank[a.id] || 0)).slice(0, 8), [products, salesRank]);
  const activeFilters = Number(availabilityFilter !== "all") + Number(customOnly);


  return (
    <>
      <Header />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <Sparkles size={14} /> FEITO PARA SER ÚNICO
            </span>
            <h1>
              Ideias que
              <br />
              <em>ganham forma.</em>
            </h1>
            <p>
              Produtos criativos, personalizados e produzidos em impressão 3D
              para deixar sua rotina com mais personalidade.
            </p>
            <a className="button button-dark" href="#catalogo">
              Explorar catálogo <ArrowDown size={17} />
            </a>
            <div className="hero-note">
              <span className="note-dot" /> Peças feitas com cuidado, uma camada
              de cada vez.
            </div>
          </div>
          <div className="hero-art">
            <div className="hero-art-inner">
              {/* <span className="art-kicker">CAN / OBJECTS</span>
              <div className="art-shape shape-one" />
              <div className="art-shape shape-two" />
              <div className="art-shape shape-three" />
              <div className="art-caption">
                <span>DESIGN FUNCIONAL</span>
                <strong>
                  Pequenas ideias.
                  <br />
                  Grandes possibilidades.
                </strong>
              </div>
              <span className="art-index">01 — 03</span> */}
              <img src={imagemHero} alt="Logo CAN Group" />
            </div>
          </div>
        </section>
        <section className="catalog-section" id="catalogo">
          <div className="section-intro">
            <div>
              <span className="eyebrow">NOSSA VITRINE</span>
              <h2>
                Encontre sua próxima
                <br />
                <em>ideia favorita.</em>
              </h2>
            </div>
            <p>
              Explore as peças disponíveis e fale diretamente com a gente para
              pedir ou personalizar a sua.
            </p>
          </div>
          {!isSupabaseConfigured && (
            <div className="setup-notice">
              <strong>Catálogo em configuração</strong>
              <span>
                Conecte o projeto Supabase para carregar e administrar os
                produtos reais. As fotos e os preços serão inseridos pelo
                painel.
              </span>
            </div>
          )}
          {!loading && !error && newProducts.length > 0 && <section className="catalog-collection"><div className="catalog-collection-heading"><div><span className="eyebrow">CHEGARAM AGORA</span><h2>Novidades.</h2></div><span>Adicionados recentemente</span></div><div className="catalog-collection-grid">{newProducts.map(p=><ProductCard key={p.id} product={p}/>)}</div></section>}
          {!loading && !error && bestSellingProducts.length > 0 && <section className="catalog-collection"><div className="catalog-collection-heading"><div><span className="eyebrow">PREFERIDOS</span><h2>Mais <em>procurados.</em></h2></div><span>Com base nas vendas registradas</span></div><div className="catalog-collection-grid">{bestSellingProducts.map(p=><ProductCard key={p.id} product={p}/>)}</div></section>}
          {!loading && !error && customizedProducts.length > 0 && <section className="catalog-collection"><div className="catalog-collection-heading"><div><span className="eyebrow">DO SEU JEITO</span><h2>Personalizados.</h2></div><span>Peças que podem ganhar sua identidade</span></div><div className="catalog-collection-grid">{customizedProducts.map(p=><ProductCard key={p.id} product={p}/>)}</div></section>}
          {!loading && !error && featuredProducts.length > 0 && (
            <section className="featured-section" aria-label="Produtos em destaque">
              <div className="featured-heading">
                <div>
                  <span className="eyebrow"><Star size={14} fill="currentColor" /> ESCOLHAS CAN GROUP</span>
                  <h2>Em <em>destaque.</em></h2>
                  <p>Peças que merecem aparecer primeiro.</p>
                </div>
                <div className="featured-controls">
                  <button type="button" aria-label="Ver destaques anteriores" onClick={() => scrollFeatured(-1)}><ChevronLeft size={19}/></button>
                  <button type="button" aria-label="Ver próximos destaques" onClick={() => scrollFeatured(1)}><ChevronRight size={19}/></button>
                </div>
              </div>
              <div className="featured-track" ref={featuredTrackRef}>
                {featuredProducts.map((p) => <div className="featured-slide" key={p.id}><ProductCard product={p} /></div>)}
              </div>
              <div className="featured-hint">Deslize para explorar <span>← →</span></div>
            </section>
          )}
          {isSupabaseConfigured && (
            <div className="catalog-tools catalog-tools-sticky">
              <label className="search-field">
                <Search size={18} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por produto ou categoria..." />
                {query && <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca"><X size={16}/></button>}
              </label>
              <div className="category-list" aria-label="Categorias do catálogo">
                <button className={category === "all" ? "category-chip active" : "category-chip"} onClick={() => setCategory("all")}>Todos <small>{products.filter(p=>p.availability!=="unavailable").length}</small></button>
                {categories.map((item) => <button key={item.id} className={category === item.id ? "category-chip active" : "category-chip"} onClick={() => setCategory(item.id)}>{item.name} <small>{products.filter(p=>p.category_id===item.id && p.availability!=="unavailable").length}</small></button>)}
              </div>
              <div className="catalog-control-row">
                <span>{visibleProducts.length} {visibleProducts.length === 1 ? "produto encontrado" : "produtos encontrados"}</span>
                <div>
                  <label className="catalog-sort"><ArrowDownWideNarrow size={15}/><select value={sortBy} onChange={e=>setSortBy(e.target.value)} aria-label="Ordenar produtos"><option value="featured">Relevância</option><option value="newest">Mais recentes</option><option value="best_selling">Mais vendidos</option><option value="price_asc">Menor preço</option><option value="price_desc">Maior preço</option><option value="name">Ordem alfabética</option></select></label>
                  <button type="button" className="catalog-filter-trigger" onClick={()=>setFilterOpen(true)}><SlidersHorizontal size={15}/> Filtros {activeFilters>0 && <b>{activeFilters}</b>}</button>
                </div>
              </div>
            </div>
          )}
          {filterOpen && <div className="catalog-filter-backdrop" role="presentation" onClick={()=>setFilterOpen(false)}>
            <section className="catalog-filter-sheet" role="dialog" aria-modal="true" aria-labelledby="catalog-filter-title" onClick={e=>e.stopPropagation()}>
              <div className="catalog-filter-heading"><h3 id="catalog-filter-title">Filtrar produtos</h3><button type="button" onClick={()=>setFilterOpen(false)} aria-label="Fechar filtros"><X size={19}/></button></div>
              <label>Disponibilidade<select value={availabilityFilter} onChange={e=>setAvailabilityFilter(e.target.value)}><option value="all">Todas</option><option value="available">Disponível</option><option value="made_to_order">Sob encomenda</option></select></label>
              <label className="catalog-filter-check"><input type="checkbox" checked={customOnly} onChange={e=>setCustomOnly(e.target.checked)}/> Somente produtos personalizados</label>
              <div className="catalog-filter-actions"><button type="button" className="button button-outline" onClick={()=>{setAvailabilityFilter("all");setCustomOnly(false);setCategory("all");setQuery("");setSortBy("featured");}}>Limpar filtros</button><button type="button" className="button button-dark" onClick={()=>setFilterOpen(false)}>Ver {visibleProducts.length} produtos</button></div>
            </section>
          </div>}
          {loading ? (
            <div className="empty-state">Carregando catálogo...</div>
          ) : error ? (
            <div className="empty-state">{error}</div>
          ) : visibleProducts.length ? (
            <div className="product-grid" id="resultados">
              {visibleProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-icon">
                <Search size={22} />
              </span>
              <h3>
                {isSupabaseConfigured
                  ? "Estamos preparando a vitrine."
                  : "Novidades chegando em breve."}
              </h3>
              <p>
                {isSupabaseConfigured
                  ? "Assim que os produtos forem cadastrados e publicados, eles aparecerão aqui."
                  : "Os produtos reais da CAN Group serão exibidos aqui assim que o banco de dados estiver conectado."}
              </p>
            </div>
          )}
        </section>
        <section className="contact-band">
          <div>
            <span className="eyebrow">TEM UMA IDEIA?</span>
            <h2>
              Vamos tirar do
              <br />
              <em>papel — ou da tela.</em>
            </h2>
            <p>
              Precisa de algo personalizado? Conte pra gente o que imaginou.
            </p>
          </div>
          <a
            className="button button-light"
            href="https://wa.me/5513997092751?text=Ol%C3%A1%2C%20CAN%20Group!%20Quero%20conversar%20sobre%20um%20produto%20personalizado."
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={17} /> Falar no WhatsApp{" "}
            <ArrowUpRight size={16} />
          </a>
          <span className="band-decoration">CAN.</span>
        </section>
      </main>
      <Footer />
    </>
  );
}
