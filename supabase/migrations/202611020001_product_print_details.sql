create table if not exists public.product_print_details (
  product_id uuid primary key references public.products(id) on delete cascade,
  makerworld_url text not null default '',
  filament_weight_g numeric(10,2) check (filament_weight_g is null or filament_weight_g >= 0),
  updated_at timestamptz not null default now()
);

alter table public.product_print_details enable row level security;

create policy "Admins can read product print details"
on public.product_print_details for select to authenticated
using (exists (select 1 from public.catalog_admins ca where ca.user_id = (select auth.uid())));

create policy "Admins can insert product print details"
on public.product_print_details for insert to authenticated
with check (exists (select 1 from public.catalog_admins ca where ca.user_id = (select auth.uid())));

create policy "Admins can update product print details"
on public.product_print_details for update to authenticated
using (exists (select 1 from public.catalog_admins ca where ca.user_id = (select auth.uid())))
with check (exists (select 1 from public.catalog_admins ca where ca.user_id = (select auth.uid())));

create policy "Admins can delete product print details"
on public.product_print_details for delete to authenticated
using (exists (select 1 from public.catalog_admins ca where ca.user_id = (select auth.uid())));

grant select, insert, update, delete on public.product_print_details to authenticated;
revoke all on public.product_print_details from anon;
