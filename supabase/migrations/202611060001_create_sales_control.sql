create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  sold_at timestamptz not null default now(),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);
create index if not exists sales_sold_at_idx on public.sales(sold_at desc);
create index if not exists sale_items_sale_id_idx on public.sale_items(sale_id);
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
drop policy if exists "Admins manage sales" on public.sales;
create policy "Admins manage sales" on public.sales for all to authenticated
using (exists (select 1 from public.catalog_admins ca where ca.user_id = (select auth.uid())))
with check (exists (select 1 from public.catalog_admins ca where ca.user_id = (select auth.uid())));
drop policy if exists "Admins manage sale items" on public.sale_items;
create policy "Admins manage sale items" on public.sale_items for all to authenticated
using (exists (select 1 from public.catalog_admins ca where ca.user_id = (select auth.uid())))
with check (exists (select 1 from public.catalog_admins ca where ca.user_id = (select auth.uid())));
grant select, insert, update, delete on public.sales to authenticated;
grant select, insert, update, delete on public.sale_items to authenticated;