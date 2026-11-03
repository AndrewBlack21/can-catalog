update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm']
where id = 'product-images';
