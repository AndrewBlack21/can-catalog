-- CAN Group Catalog: initial schema and security policies
create extension if not exists pgcrypto;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  slug text not null unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 140),
  slug text not null unique,
  description text not null default '',
  price_mode text not null default 'fixed' check (price_mode in ('fixed', 'quote')),
  price numeric(10,2),
  availability text not null default 'available' check (availability in ('available', 'made_to_order', 'unavailable')),
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  customization_enabled boolean not null default false,
  featured boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_price_rule check (
    (price_mode = 'fixed' and price is not null and price >= 0)
    or (price_mode = 'quote' and price is null)
  )
);

create table public.catalog_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  alt_text text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (storage_path)
);

create index products_catalog_idx on public.products (category_id, featured, name) where published = true;
create index product_images_order_idx on public.product_images (product_id, sort_order);

create or replace function public.is_catalog_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.catalog_admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.is_catalog_admin() from public;
grant execute on function public.is_catalog_admin() to authenticated;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.catalog_admins enable row level security;
alter table public.product_images enable row level security;

revoke all on public.categories, public.products, public.catalog_admins, public.product_images from anon, authenticated;
grant select on public.categories, public.products, public.product_images to anon, authenticated;
grant insert, update, delete on public.categories, public.products, public.product_images to authenticated;
grant select on public.catalog_admins to authenticated;

create policy "Public reads active categories" on public.categories for select to anon, authenticated using (active = true);
create policy "Admins manage categories" on public.categories for all to authenticated using ((select public.is_catalog_admin())) with check ((select public.is_catalog_admin()));
create policy "Public reads published products" on public.products for select to anon, authenticated using (published = true);
create policy "Admins manage products" on public.products for all to authenticated using ((select public.is_catalog_admin())) with check ((select public.is_catalog_admin()));
create policy "Admins read own authorization" on public.catalog_admins for select to authenticated using (user_id = (select auth.uid()));
create policy "Public reads images of published products" on public.product_images for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id and p.published = true));
create policy "Admins manage product images" on public.product_images for all to authenticated using ((select public.is_catalog_admin())) with check ((select public.is_catalog_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif'];

create policy "Public reads catalog images" on storage.objects for select to anon, authenticated using (bucket_id = 'product-images');
create policy "Admins upload catalog images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and (select public.is_catalog_admin()));
create policy "Admins update catalog images" on storage.objects for update to authenticated using (bucket_id = 'product-images' and (select public.is_catalog_admin())) with check (bucket_id = 'product-images' and (select public.is_catalog_admin()));
create policy "Admins delete catalog images" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and (select public.is_catalog_admin()));

insert into public.categories (name, slug, sort_order) values
  ('Chaveiros', 'chaveiros', 1),
  ('Organização', 'organizacao', 2),
  ('Decoração', 'decoracao', 3),
  ('Personalizados', 'personalizados', 4)
on conflict (slug) do nothing;
