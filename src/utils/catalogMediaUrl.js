/**
 * Resolve mídias do catálogo público a partir de arquivos publicados em
 * public/catalog-images. A estrutura de pastas do storage_path é preservada:
 * public/catalog-images/<storage_path>.
 *
 * Exemplo:
 * storage_path: "products/abc/foto.webp"
 * arquivo:      public/catalog-images/products/abc/foto.webp
 */
export function getProductImage(storagePath) {
  if (!storagePath || typeof storagePath !== "string") return null;

  let path = storagePath.trim().replace(/\\/g, "/");
  if (!path) return null;

  // Converte URLs antigas do bucket público do Supabase para o caminho local.
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      const marker = "/storage/v1/object/public/product-images/";
      const markerIndex = url.pathname.indexOf(marker);
      if (markerIndex >= 0) {
        path = url.pathname.slice(markerIndex + marker.length);
      } else {
        return path;
      }
    } catch {
      return null;
    }
  }

  path = path.replace(/^\/+/, "").replace(/^product-images\//i, "");
  const segments = path.split("/").filter((segment) => segment && segment !== "." && segment !== "..");
  if (!segments.length) return null;

  const safePath = segments.map((segment) => {
    try {
      return encodeURIComponent(decodeURIComponent(segment));
    } catch {
      return encodeURIComponent(segment);
    }
  }).join("/");

  return `/catalog-images/${safePath}`;
}

export const getCatalogMediaUrl = getProductImage;
