create table if not exists public.filament_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  material text not null default 'PLA',
  color text not null default '',
  spool_weight_g numeric(10,2) not null default 1000 check (spool_weight_g > 0),
  spool_price numeric(10,2) not null check (spool_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.filament_types enable row level security;

create policy "Admins can read filament types"
on public.filament_types for select to authenticated
using (exists (
  select 1 from public.catalog_admins ca where ca.user_id = (select auth.uid())
));

create policy "Admins can insert filament types"
on public.filament_types for insert to authenticated
with check (exists (
  select 1 from public.catalog_admins ca where ca.user_id = (select auth.uid())
));

create policy "Admins can update filament types"
on public.filament_types for update to authenticated
using (exists (
  select 1 from public.catalog_admins ca where ca.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.catalog_admins ca where ca.user_id = (select auth.uid())
));

create policy "Admins can delete filament types"
on public.filament_types for delete to authenticated
using (exists (
  select 1 from public.catalog_admins ca where ca.user_id = (select auth.uid())
));

grant select, insert, update, delete on public.filament_types to authenticated;
