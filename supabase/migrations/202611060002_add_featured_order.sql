alter table public.products add column if not exists featured_order integer;

with ranked as (
  select id, row_number() over (order by name asc) as position
  from public.products
  where featured = true and featured_order is null
)
update public.products p
set featured_order = ranked.position
from ranked
where p.id = ranked.id;
