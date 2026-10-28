import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUpRight, Search, Sparkles, MessageCircle } from 'lucide-react';
import Header from '../../components/Header.jsx';
import Footer from '../../components/Footer.jsx';
import ProductCard from '../../components/ProductCard.jsx';
import { isSupabaseConfigured, supabase } from '../../lib/supabase.js';

export default function CatalogPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    async function load() {
      setLoading(true);
      const [productResult, categoryResult] = await Promise.all([
        supabase.from('products').select('*, product_images(*)').eq('published', true).order('featured', { ascending: false }).order('name'),
        supabase.from('categories').select('id,name,slug').eq('active', true).order('sort_order')
      ]);
      if (!active) return;
      if (productResult.error) setError('Não foi possível carregar os produtos. Confira a configuração do Supabase.');
      else setProducts(productResult.data || []);
      if (!categoryResult.error) setCategories(categoryResult.data || []);
      setLoading(false);
    }
    load(); return () => { active = false; };
  }, []);

  const visibleProducts = useMemo(() => products.filter(p => {
    const matchesQuery = `${p.name} ${p.description}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (category === 'all' || p.category_id === category) && p.availability !== 'unavailable';
  }), [products, query, category]);

  return <><Header/><main>
    <section className="hero"><div className="hero-copy"><span className="eyebrow"><Sparkles size={14}/> FEITO PARA SER ÚNICO</span><h1>Ideias que<br/><em>ganham forma.</em></h1><p>Produtos criativos, personalizados e produzidos em impressão 3D para deixar sua rotina com mais personalidade.</p><a className="button button-dark" href="#catalogo">Explorar catálogo <ArrowDown size={17}/></a><div className="hero-note"><span className="note-dot"/> Peças feitas com cuidado, uma camada de cada vez.</div></div><div className="hero-art"><div className="hero-art-inner"><span className="art-kicker">CAN / OBJECTS</span><div className="art-shape shape-one"/><div className="art-shape shape-two"/><div className="art-shape shape-three"/><div className="art-caption"><span>DESIGN FUNCIONAL</span><strong>Pequenas ideias.<br/>Grandes possibilidades.</strong></div><span className="art-index">01 — 03</span></div></div></section>
    <section className="catalog-section" id="catalogo"><div className="section-intro"><div><span className="eyebrow">NOSSA VITRINE</span><h2>Encontre sua próxima<br/><em>ideia favorita.</em></h2></div><p>Explore as peças disponíveis e fale diretamente com a gente para pedir ou personalizar a sua.</p></div>
      {!isSupabaseConfigured && <div className="setup-notice"><strong>Catálogo em configuração</strong><span>Conecte o projeto Supabase para carregar e administrar os produtos reais. As fotos e os preços serão inseridos pelo painel.</span></div>}
      {isSupabaseConfigured && <div className="catalog-tools"><label className="search-field"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar produtos..."/></label><div className="category-list"><button className={category === 'all' ? 'category-chip active' : 'category-chip'} onClick={() => setCategory('all')}>Todos</button>{categories.map(c => <button key={c.id} className={category === c.id ? 'category-chip active' : 'category-chip'} onClick={() => setCategory(c.id)}>{c.name}</button>)}</div></div>}
      {loading ? <div className="empty-state">Carregando catálogo...</div> : error ? <div className="empty-state">{error}</div> : visibleProducts.length ? <div className="product-grid">{visibleProducts.map(p => <ProductCard key={p.id} product={p}/>)}</div> : <div className="empty-state"><span className="empty-icon"><Search size={22}/></span><h3>{isSupabaseConfigured ? 'Estamos preparando a vitrine.' : 'Novidades chegando em breve.'}</h3><p>{isSupabaseConfigured ? 'Assim que os produtos forem cadastrados e publicados, eles aparecerão aqui.' : 'Os produtos reais da CAN Group serão exibidos aqui assim que o banco de dados estiver conectado.'}</p></div>}
    </section>
    <section className="contact-band"><div><span className="eyebrow">TEM UMA IDEIA?</span><h2>Vamos tirar do<br/><em>papel — ou da tela.</em></h2><p>Precisa de algo personalizado? Conte pra gente o que imaginou.</p></div><a className="button button-light" href="https://wa.me/5513997092751?text=Ol%C3%A1%2C%20CAN%20Group!%20Quero%20conversar%20sobre%20um%20produto%20personalizado." target="_blank" rel="noreferrer"><MessageCircle size={17}/> Falar no WhatsApp <ArrowUpRight size={16}/></a><span className="band-decoration">CAN.</span></section>
  </main><Footer/></>;
}
