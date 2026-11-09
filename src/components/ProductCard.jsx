import { useRef, useState } from "react";
import { ArrowUpRight, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency } from "../utils/formatCurrency.js";
import { productWhatsAppUrl } from "../utils/whatsapp.js";
import { storageImageUrl } from "../utils/storageImageUrl.js";

export default function ProductCard({ product }) {
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);
  const touchStartX = useRef(null);
  const description = product.description || "Uma criação CAN Group feita para você.";
  const media = [...(product.product_images || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const currentMedia = media[mediaIndex];
  const mediaUrl = storageImageUrl(currentMedia?.storage_path);
  const currentIsVideo = currentMedia?.media_type === "video" || /\.(mp4|webm)(\?|$)/i.test(currentMedia?.storage_path || "");
  const availability = {
    available: "Disponível",
    made_to_order: "Sob encomenda",
    unavailable: "Indisponível",
  }[product.availability];
  const moveMedia = (direction) => setMediaIndex(index => (index + direction + media.length) % media.length);
  const handleTouchStart = (event) => { touchStartX.current = event.touches[0]?.clientX ?? null; };
  const handleTouchEnd = (event) => {
    if (touchStartX.current === null || media.length < 2) return;
    const delta = event.changedTouches[0]?.clientX - touchStartX.current;
    if (Math.abs(delta) > 35) moveMedia(delta < 0 ? 1 : -1);
    touchStartX.current = null;
  };
  return (
    <article className="product-card">
      <div className="product-image" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <Link to={`/produto/${product.slug}`} className="product-image-link" aria-label={`Ver ${product.name}`}>
          {mediaUrl ? (
            currentIsVideo ? (
              <video src={mediaUrl} muted loop autoPlay playsInline aria-label={product.name} />
            ) : (
              <img src={mediaUrl} alt={currentMedia?.alt_text || product.name} />
            )
          ) : (
            <div className="image-placeholder"><span>CAN</span><small>FOTO DO PRODUTO</small></div>
          )}
        </Link>
        {media.length > 1 && (
          <>
            <button type="button" className="product-gallery-arrow previous" aria-label="Mídia anterior" onClick={() => moveMedia(-1)}><ChevronLeft size={17}/></button>
            <button type="button" className="product-gallery-arrow next" aria-label="Próxima mídia" onClick={() => moveMedia(1)}><ChevronRight size={17}/></button>
            <span className="product-gallery-count">{mediaIndex + 1}/{media.length}</span>
            <div className="product-gallery-dots" aria-label="Selecionar mídia">{media.map((item, index) => <button key={item.id || item.storage_path || index} type="button" className={index === mediaIndex ? "active" : ""} aria-label={`Mostrar mídia ${index + 1}`} aria-pressed={index === mediaIndex} onClick={() => setMediaIndex(index)} />)}</div>
          </>
        )}
        <span className={`availability availability-${product.availability}`}>{availability}</span>
      </div>
      <div className="product-info">
        <div className="product-heading">
          <h3>{product.name}</h3>
          <Link to={`/produto/${product.slug}`} aria-label={`Detalhes de ${product.name}`}><ArrowUpRight size={18} /></Link>
        </div>
        <p className={descriptionExpanded ? "product-description expanded" : "product-description"}>{description}</p>
        {description.length > 105 && <button type="button" className="product-more" aria-expanded={descriptionExpanded} onClick={() => setDescriptionExpanded(expanded => !expanded)}>{descriptionExpanded ? "Menos" : "Mais"}</button>}
        {product.available_colors?.length > 0 && <div className="product-colors"><small>Cores:</small>{product.available_colors.map(color => <span key={color}>{color}</span>)}</div>}
        <div className="product-bottom">
          <strong>{product.price_mode === "quote" ? "Consultar preço" : formatCurrency(product.price)}</strong>
          {product.availability !== "unavailable" && <a className="whatsapp-mini" href={productWhatsAppUrl(product)} target="_blank" rel="noreferrer"><MessageCircle size={15} /> Pedir</a>}
        </div>
      </div>
    </article>
  );
}
