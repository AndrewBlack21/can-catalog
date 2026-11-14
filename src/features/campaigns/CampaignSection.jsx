import { useEffect, useState } from "react";
import { Clock3, MessageCircle, Tag } from "lucide-react";
import ProductCard from "../../components/ProductCard.jsx";
import { formatCurrency } from "../../utils/formatCurrency.js";

const whatsappNumber = (import.meta.env.VITE_WHATSAPP_NUMBER || "5513997092751").replace(/\D/g, "");
const formatRemaining = (milliseconds) => {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { days, hours, minutes, seconds };
};

function CampaignCountdown({ endsAt }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = formatRemaining(new Date(endsAt).getTime() - now);
  return (
    <div className="campaign-countdown" aria-live="off">
      <span><Clock3 size={15}/> Termina em</span>
      <strong>{String(remaining.days).padStart(2, "0")}d : {String(remaining.hours).padStart(2, "0")}h : {String(remaining.minutes).padStart(2, "0")}m : {String(remaining.seconds).padStart(2, "0")}s</strong>
    </div>
  );
}

function campaignWhatsAppUrl(product, campaign) {
  const price = product.promo_price !== null && product.promo_price !== undefined
    ? `Preço promocional: ${formatCurrency(product.promo_price)} (preço original: ${product.price_mode === "quote" ? "sob consulta" : formatCurrency(product.price)})`
    : product.price_mode === "quote" ? "Preço sob consulta" : `Preço: ${formatCurrency(product.price)}`;
  const message = [
    "Olá, CAN Group! Tenho interesse em um produto da campanha:",
    `Campanha: ${campaign.name}`,
    `Produto: ${product.name}`,
    price,
    `Link: ${window.location.origin}/produto/${product.slug}`
  ].join("\n");
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export default function CampaignSection({ campaign, loading = false, error = "" }) {
  const products = campaign?.products || [];
  if (!campaign && error) return <section className="campaign-section campaign-feedback" role="status">Não foi possível carregar as ofertas desta campanha no momento.</section>;
  if (!campaign && loading) return <section className="campaign-section campaign-feedback" aria-live="polite">Verificando campanhas especiais...</section>;
  if (!campaign || !products.length) return null;
  return (
    <section className="campaign-section" aria-labelledby="campaign-headline" style={{"--campaign-brand":campaign.theme_colors?.brand || "var(--brand)","--campaign-accent":campaign.theme_colors?.accent || "var(--accent)","--campaign-bg":campaign.theme_colors?.background || "var(--bg)","--campaign-text":campaign.theme_colors?.text || "var(--text)","--campaign-button-text":campaign.theme_colors?.button_text || "#ffffff"}}>
      <div className="campaign-section-inner">
        {campaign.banner_url && <div className="campaign-hero-banner" style={{backgroundImage:`linear-gradient(90deg, rgba(0,0,0,.72), rgba(0,0,0,.12)), url("${campaign.banner_url}")`}}>
          <div className="campaign-banner-copy">
            <span className="campaign-kicker"><Tag size={14}/> CAMPANHA ESPECIAL · {campaign.name}</span>
            <h2 id="campaign-headline">{campaign.headline}</h2>
            {campaign.subtitle && <p>{campaign.subtitle}</p>}
            <CampaignCountdown endsAt={campaign.ends_at}/>
          </div>
        </div>}
        {!campaign.banner_url && <div className="campaign-section-top">
          <div>
            <span className="campaign-kicker"><Tag size={14}/> CAMPANHA ESPECIAL · {campaign.name}</span>
            <h2 id="campaign-headline">{campaign.headline}</h2>
            {campaign.subtitle && <p>{campaign.subtitle}</p>}
          </div>
          <CampaignCountdown endsAt={campaign.ends_at}/>
        </div>}
        <div className="campaign-product-grid">
          {products.map(product => (
            <div className="campaign-product-item" key={product.id}>
              <ProductCard product={product} promoPrice={product.promo_price}/>
              <a className="campaign-whatsapp-link" href={campaignWhatsAppUrl(product, campaign)} target="_blank" rel="noreferrer">
                <MessageCircle size={16}/> Consultar esta oferta
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
