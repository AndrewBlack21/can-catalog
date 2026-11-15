import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabase.js";

const THEME_KEYS = ["black-friday", "natal", "dia-das-maes", "dia-dos-pais"];
const CACHE_KEY = "can-active-campaign-theme";
const hexToRgb = hex => {
  const value = String(hex || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  return [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16) / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
};
const luminance = hex => {
  const rgb = hexToRgb(hex);
  return rgb ? .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2] : .95;
};
const mixHex = (first, second, amount) => {
  const a = String(first || "").replace("#", ""), b = String(second).replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(a) || !/^[0-9a-f]{6}$/i.test(b)) return first;
  return "#" + [0,2,4].map(index => Math.round(parseInt(a.slice(index,index+2),16) * (1-amount) + parseInt(b.slice(index,index+2),16) * amount).toString(16).padStart(2,"0")).join("");
};
const contrastRatio = (first, second) => {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
};
const normalizePalette = (colors = {}) => {
  const background = colors.background || "#f5f4ef";
  const dark = luminance(background) < .42;
  const text = contrastRatio("#ffffff", background) >= contrastRatio("#191919", background) ? "#ffffff" : "#191919";
  return {
    background,
    brand: background,
    accent: background,
    card: colors.card || mixHex(background, dark ? "#ffffff" : "#000000", dark ? .09 : .035),
    text,
    button_text: text
  };
};
const clearCampaignTheme = () => {
  document.documentElement.removeAttribute("data-theme");
  ["--brand","--accent","--bg","--card","--text","--campaign-button-text","--forest","--sage","--paper","--ink","--line","--muted"].forEach(key => document.documentElement.style.removeProperty(key));
};
const applyCampaignTheme = (slug, rawColors = {}) => {
  const root = document.documentElement;
  const colors = normalizePalette(rawColors);
  const dark = luminance(colors.background) < .42;
  root.dataset.theme = slug;
  const variables = {
    "--brand": colors.brand, "--forest": colors.brand,
    "--accent": colors.accent, "--sage": colors.accent,
    "--bg": colors.background, "--paper": colors.background,
    "--card": colors.card,
    "--text": colors.text, "--ink": colors.text,
    "--campaign-button-text": colors.button_text,
    "--line": mixHex(colors.background, colors.text, dark ? .28 : .16),
    "--muted": mixHex(colors.text, colors.background, .38)
  };
  Object.entries(variables).forEach(([key, value]) => value ? root.style.setProperty(key, value) : root.style.removeProperty(key));
};

export function useActiveCampaign(enabled = true) {
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) {
      clearCampaignTheme();
      setCampaign(null);
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      clearCampaignTheme();
      return;
    }
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached && THEME_KEYS.includes(cached.slug) && new Date(cached.startsAt).getTime() <= Date.now() && new Date(cached.endsAt).getTime() > Date.now()) applyCampaignTheme(cached.slug, cached.theme_colors || {});
    } catch {}
    let alive = true;
    let expiryTimer = null;
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
        clearCampaignTheme();
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
          .filter(item => item.products.length > 0)
          .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))[0] || null;
        if (selected && THEME_KEYS.includes(selected.slug)) {
          const colors = selected.theme_colors || {};
          applyCampaignTheme(selected.slug, colors);
          selected.banner_url = selected.banner_path ? supabase.storage.from("product-images").getPublicUrl(selected.banner_path).data.publicUrl : null;
          try { localStorage.setItem(CACHE_KEY, JSON.stringify({ slug: selected.slug, startsAt: selected.starts_at, endsAt: selected.ends_at, theme_colors: colors })); } catch {}
        } else {
          clearCampaignTheme();
          try { localStorage.removeItem(CACHE_KEY); } catch {}
        }
        setCampaign(selected);
        if (expiryTimer) window.clearTimeout(expiryTimer);
        if (selected?.ends_at) {
          const remaining = new Date(selected.ends_at).getTime() - Date.now();
          if (remaining > 0) expiryTimer = window.setTimeout(() => { if (alive) loadCampaign(); }, Math.min(remaining + 1000, 2147483647));
        }
      }
      setLoading(false);
    }
    loadCampaign();
    return () => { alive = false; if (expiryTimer) window.clearTimeout(expiryTimer); };
  }, [enabled]);

  return { campaign, loading, error };
}
