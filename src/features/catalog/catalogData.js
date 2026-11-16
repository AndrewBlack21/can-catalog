import { isSupabaseConfigured, supabase } from "../../lib/supabase.js";

const PRODUCT_SELECT =
  "id,name,slug,description,price,price_mode,availability,featured,featured_order,customization_enabled,created_at,category_id,sales_count,categories(name),product_images(id,storage_path,media_type,sort_order,alt_text)";

async function loadStaticCatalog() {
  const response = await fetch("/catalog.json");
  if (!response.ok) throw new Error("Não foi possível carregar /catalog.json.");
  const data = await response.json();
  if (!Array.isArray(data.products) || !Array.isArray(data.categories)) {
    throw new Error("catalog.json precisa conter products e categories.");
  }
  return data;
}

export async function loadCatalog() {
  if (isSupabaseConfigured && supabase) {
    try {
      const [productResult, categoryResult] = await Promise.all([
        supabase.from("products").select(PRODUCT_SELECT).eq("published", true)
          .order("featured", { ascending: false })
          .order("featured_order", { ascending: true, nullsFirst: false })
          .order("name"),
        supabase.from("categories").select("id,name,slug").eq("active", true)
          .order("sort_order"),
      ]);
      if (productResult.error) throw productResult.error;
      if (categoryResult.error) throw categoryResult.error;
      return { products: productResult.data || [], categories: categoryResult.data || [], source: "supabase" };
    } catch (error) {
      console.warn("Supabase indisponível. Carregando catálogo estático.", error);
    }
  }
  const data = await loadStaticCatalog();
  return { ...data, source: "json" };
}

export async function loadProductBySlug(slug) {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from("products").select("*,product_images(*)")
        .eq("slug", slug).eq("published", true).maybeSingle();
      if (error) throw error;
      if (data) return data;
    } catch (error) {
      console.warn("Não foi possível consultar o produto no Supabase.", error);
    }
  }
  const catalog = await loadStaticCatalog();
  return catalog.products.find((product) => product.slug === slug) || null;
}
