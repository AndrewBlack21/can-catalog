import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabase.js";

const THEME_KEYS = ["black-friday", "natal", "dia-das-maes", "dia-dos-pais"];
const CACHE_KEY = "can-active-campaign-theme";

export function useActiveCampaign(enabled = true) {
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) {
      document.documentElement.removeAttribute("data-theme");
      setCampaign(null);
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      document.documentElement.removeAttribute("data-theme");
      return;
    }
    let alive = true;
    async function loadCampaign() {
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from("campaigns")
        .select("id,name,slug,headline,subtitle,starts_at,ends_at,priority,banner_path,theme_colors,campaign_products(product_id,promo_price,position,products(id,name,slug,description,price,price_mode,availability,featured,customization_enabled,created_at,category_id,categories(name),product_images(id,storage_path,media_type,sort_order,alt_text)))")
        .eq("is_active", true)
        .lte("starts_at", new Date().toISOString())
        .gte("ends_at", new Date().toISOString())
        .order("priority", { ascending: false });

      if (!alive) return;
      if (queryError) {
        setError("Não foi possível carregar a campanha ativa.");
        setCampaign(null);
        document.documentElement.removeAttribute("data-theme");
        try { localStorage.removeItem(CACHE_KEY); } catch {}
      } else {
        const selected = (data || [])
          .map(item => ({
            ...item,
            products: (item.campaign_products || [])
              .filter(link => link.products && link.products.availability !== "unavailable")
              .sort((a, b) => a.position - b.position)
              .map(link => ({ ...link.products, promo_price: link.promo_price, campaign_id: item.id }))
          }))
          .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))[0] || null;
        setCampaign(selected);
        if (selected && THEME_KEYS.includes(selected.slug)) {
          document.documentElement.dataset.theme = selected.slug;
          const colors = selected.theme_colors || {};
          const root = document.documentElement;
          const cssVariables = { "--brand": colors.brand, "--accent": colors.accent, "--bg": colors.background, "--text": colors.text, "--campaign-button-text": colors.button_text };
          Object.entries(cssVariables).forEach(([key, value]) => value ? root.style.setProperty(key, value) : root.style.removeProperty(key));
          selected.banner_url = selected.banner_path ? supabase.storage.from("product-images").getPublicUrl(selected.banner_path).data.publicUrl : null;
          try { localStorage.setItem(CACHE_KEY, JSON.stringify({ slug: selected.slug, endsAt: selected.ends_at, theme_colors: colors })); } catch {}
        } else {
          document.documentElement.removeAttribute("data-theme");
          ["--brand","--accent","--bg","--text","--campaign-button-text"].forEach(key => document.documentElement.style.removeProperty(key));
          try { localStorage.removeItem(CACHE_KEY); } catch {}
        }
      }
      setLoading(false);
    }
    loadCampaign();
    return () => { alive = false; };
  }, [enabled]);

  return { campaign, loading, error };
}
