import { useEffect, useState } from "react";
import { ArrowLeft, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import Header from "../../components/Header.jsx";
import Footer from "../../components/Footer.jsx";
import { supabase, isSupabaseConfigured } from "../../lib/supabase.js";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { productWhatsAppUrl } from "../../utils/whatsapp.js";
import { storageImageUrl } from "../../utils/storageImageUrl.js";

export default function ProductPage() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [customization, setCustomization] = useState("");
  const [loading, setLoading] = useState(true);
  const [mediaIndex, setMediaIndex] = useState(0);
  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    supabase.from("products").select("*,product_images(*)").eq("slug", slug).eq("published", true).maybeSingle()
      .then(({ data }) => { setProduct(data); setMediaIndex(0); setLoading(false); });
  }, [slug]);
  const media = [...(product?.product_images || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const currentMedia = media[mediaIndex];
  const mediaUrl = storageImageUrl(currentMedia?.storage_path);
  const moveMedia = (direction) => setMediaIndex(index => (index + direction + media.length) % media.length);
  return (
    <>
      <Header />
      <main className="detail-main">
        <Link to="/" className="back-link"><ArrowLeft size={16} /> Voltar ao catálogo</Link>
        {loading ? <p>Carregando produto...</p> : !product ? (
          <div className="empty-state"><h2>Produto não encontrado</h2><p>Este produto pode não estar publicado no momento.</p></div>
        ) : (
          <div className="detail-layout">
            <div className="product-detail-gallery">
              <div className="product-detail-stage">
                {mediaUrl ? (currentMedia?.media_type === "video" ? <video src={mediaUrl} controls playsInline /> : <img src={mediaUrl} alt={currentMedia?.alt_text || product.name} />) : (
                  <div className="image-placeholder"><span>CAN</span><small>FOTO DO PRODUTO</small></div>
                )}
                {media.length > 1 && <>
                  <button type="button" className="product-gallery-arrow previous" aria-label="Mídia anterior" onClick={() => moveMedia(-1)}><ChevronLeft size={20}/></button>
                  <button type="button" className="product-gallery-arrow next" aria-label="Próxima mídia" onClick={() => moveMedia(1)}><ChevronRight size={20}/></button>
                  <span className="product-gallery-count">{mediaIndex + 1}/{media.length}</span>
                </>}
              </div>
              {media.length > 1 && <div className="product-gallery-thumbnails">{media.map((item,index) => {
                const url=storageImageUrl(item.storage_path);
                return <button type="button" key={item.id || item.storage_path} className={index===mediaIndex ? "active" : ""} onClick={()=>setMediaIndex(index)} aria-label={`Ver mídia ${index+1}`}>{item.media_type==="video" ? <span>VÍDEO</span> : <img src={url} alt=""/>}</button>;
              })}</div>}
            </div>
            <div className="detail-copy">
              <span className="eyebrow">CAN GROUP / PRODUTO</span>
              <h1>{product.name}</h1>
              <p>{product.description}</p>
              <div className="detail-price">{product.price_mode === "quote" ? "Preço sob consulta" : formatCurrency(product.price)}</div>
              <span className="availability-text">{product.availability === "made_to_order" ? "Produzido sob encomenda" : product.availability === "unavailable" ? "Indisponível" : "Disponível"}</span>
              {product.available_colors?.length > 0 && <div className="detail-colors"><strong>Cores disponíveis</strong><div>{product.available_colors.map(color=><span key={color}>{color}</span>)}</div></div>}
              {product.customization_enabled && <label className="custom-field">Como você gostaria de personalizar?<textarea value={customization} onChange={e=>setCustomization(e.target.value)} placeholder="Informe nome, cor ou outros detalhes..." rows={4}/></label>}
              {product.availability !== "unavailable" && <a className="button button-dark detail-cta" href={productWhatsAppUrl(product, customization)} target="_blank" rel="noreferrer"><MessageCircle size={18}/> Consultar pelo WhatsApp</a>}
              <small className="detail-disclaimer">Disponibilidade final, personalização e prazo de produção serão confirmados no atendimento.</small>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
