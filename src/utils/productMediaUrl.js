export function productMediaUrl(media, width = 900) {
  if (!media) return null;

  const url = media.cloudinary_url ||
    (typeof media.storage_path === "string" && (media.storage_path.startsWith("https://") || media.storage_path.startsWith("http://"))
      ? media.storage_path
      : null);

  if (!url) return null;
  if (media.media_type === "video" || media.cloudinary_resource_type === "video") return url;

  return url.includes("/upload/")
    ? url.replace("/upload/", `/upload/f_auto,q_auto,w_${width},c_limit/`)
    : url;
}
