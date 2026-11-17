export async function uploadToCloudinary(file) {
  const cloud = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', preset);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud}/auto/upload`,
    { method: 'POST', body: form }
  );
  if (!res.ok) throw new Error('Falha no upload para o Cloudinary');

  const data = await res.json();
  return {
    url: data.secure_url,
    mediaType: data.resource_type, // 'image' ou 'video'
  };
}