export async function optimizeImageFile(file, { maxDimension = 1600, quality = 0.82 } = {}) {
  if (!file?.type?.startsWith("image/") || typeof createImageBitmap !== "function") return null;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", quality));
    if (!blob || blob.size >= file.size * 0.95) return null;
    return { blob, contentType: "image/webp", extension: "webp" };
  } catch {
    return null;
  } finally {
    bitmap?.close?.();
  }
}

export function originalPathForOptimized(path) {
  if (!path) return null;
  const match = path.match(/^(.*)\/([^/]+)-optimized-([a-z0-9]+)\.webp$/i);
  return match ? `${match[1]}/${match[2]}-original.${match[3]}` : null;
}
