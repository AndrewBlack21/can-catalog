import { useState } from "react";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency } from "../utils/formatCurrency.js";
import { productWhatsAppUrl } from "../utils/whatsapp.js";
import { storageImageUrl } from "../utils/storageImageUrl.js";

export default function ProductCard({ product }) {
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const description = product.description || "Uma criação CAN Group feita para você.";
  const image = product.product_images?.[0];
  const imageUrl = storageImageUrl(image?.storage_path);
  const availability = {
    available: "Disponível",
    made_to_order: "Sob encomenda",
    unavailable: "Indisponível",
  }[product.availability];
  return (
    <article className="product-card">
      <Link
        to={`/produto/${product.slug}`}
        className="product-image-link"
        aria-label={`Ver ${product.name}`}
      >
        <div className="product-image">
          {imageUrl ? (
            <img src={imageUrl} alt={image.alt_text || product.name} />
          ) : (
            <div className="image-placeholder">
              <span>CAN</span>
              <small>FOTO DO PRODUTO</small>
            </div>
          )}
          <span className={`availability availability-${product.availability}`}>
            {availability}
          </span>
        </div>
      </Link>
      <div className="product-info">
        <div className="product-heading">
          <h3>{product.name}</h3>
          <Link
            to={`/produto/${product.slug}`}
            aria-label={`Detalhes de ${product.name}`}
          >
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <p className={descriptionExpanded ? "product-description expanded" : "product-description"}>{description}</p>
        {description.length > 105 && (
          <button
            type="button"
            className="product-more"
            aria-expanded={descriptionExpanded}
            onClick={() => setDescriptionExpanded((expanded) => !expanded)}
          >
            {descriptionExpanded ? "Menos" : "Mais"}
          </button>
        )}
        <div className="product-bottom">
          <strong>
            {product.price_mode === "quote"
              ? "Consultar preço"
              : formatCurrency(product.price)}
          </strong>
          {product.availability !== "unavailable" && (
            <a
              className="whatsapp-mini"
              href={productWhatsAppUrl(product)}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={15} /> Pedir
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
