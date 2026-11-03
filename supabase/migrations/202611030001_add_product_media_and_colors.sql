alter table public.products
  add column if not exists available_colors text[] not null default '{}';

alter table public.product_images
  add column if not exists media_type text not null default 'image';

alter table public.product_images
  drop constraint if exists product_images_media_type_check,
  add constraint product_images_media_type_check
    check (media_type in ('image', 'video'));
