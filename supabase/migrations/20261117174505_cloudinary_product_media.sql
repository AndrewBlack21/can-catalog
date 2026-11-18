-- Cloudinary becomes the media provider. Existing Supabase paths are preserved for audit/migration.
alter table public.product_images
  alter column storage_path drop not null;

alter table public.product_images
  add column if not exists cloudinary_public_id text,
  add column if not exists cloudinary_url text,
  add column if not exists cloudinary_resource_type text;

alter table public.product_images
  drop constraint if exists product_images_cloudinary_resource_type_check,
  add constraint product_images_cloudinary_resource_type_check
    check (cloudinary_resource_type is null or cloudinary_resource_type in ('image', 'video'));

alter table public.product_images
  drop constraint if exists product_images_media_source_check,
  add constraint product_images_media_source_check
    check (storage_path is not null or cloudinary_url is not null) not valid;

alter table public.product_images
  validate constraint product_images_media_source_check;

create index if not exists product_images_cloudinary_public_id_idx
  on public.product_images (cloudinary_public_id)
  where cloudinary_public_id is not null;
