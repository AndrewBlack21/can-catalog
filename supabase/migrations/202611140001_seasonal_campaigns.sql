-- Seasonal campaigns for the public catalog.
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  slug text not null check (slug in ('black-friday', 'natal', 'dia-das-maes', 'dia-dos-pais')),
  headline text not null check (char_length(trim(headline)) between 1 and 160),
  subtitle text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default false,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  constraint campaigns_valid_period check (ends_at > starts_at)
);

create table public.campaign_products (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  promo_price numeric(10,2) check (promo_price is null or promo_price >= 0),
  position integer not null default 0,
  primary key (campaign_id, product_id)
);

create index campaigns_active_period_idx on public.campaigns (is_active, starts_at, ends_at);
create index campaign_products_order_idx on public.campaign_products (campaign_id, position);

alter table public.campaigns enable row level security;
alter table public.campaign_products enable row level security;

revoke all on public.campaigns, public.campaign_products from anon, authenticated;
grant select on public.campaigns, public.campaign_products to anon, authenticated;
grant insert, update, delete on public.campaigns, public.campaign_products to authenticated;

create policy "Public reads currently active campaigns"
on public.campaigns for select to anon, authenticated
using (is_active = true and now() between starts_at and ends_at);

create policy "Admins manage campaigns"
on public.campaigns for all to authenticated
using ((select public.is_catalog_admin()))
with check ((select public.is_catalog_admin()));

create policy "Public reads products from active campaigns"
on public.campaign_products for select to anon, authenticated
using (
  exists (
    select 1
    from public.campaigns c
    join public.products p on p.id = campaign_products.product_id
    where c.id = campaign_products.campaign_id
      and c.is_active = true
      and now() between c.starts_at and c.ends_at
      and p.published = true
  )
);

create policy "Admins manage campaign products"
on public.campaign_products for all to authenticated
using ((select public.is_catalog_admin()))
with check ((select public.is_catalog_admin()));
