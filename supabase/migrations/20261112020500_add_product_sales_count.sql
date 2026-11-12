alter table public.products
  add column if not exists sales_count bigint not null default 0;

update public.products p
set sales_count = coalesce((
  select sum(si.quantity)::bigint
  from public.sale_items si
  where si.product_id = p.id
), 0);

create or replace function public.refresh_product_sales_count()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    update public.products
    set sales_count = coalesce((
      select sum(quantity)::bigint
      from public.sale_items
      where product_id = old.product_id
    ), 0)
    where id = old.product_id;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id then
    update public.products
    set sales_count = coalesce((
      select sum(quantity)::bigint
      from public.sale_items
      where product_id = old.product_id
    ), 0)
    where id = old.product_id;
  end if;

  update public.products
  set sales_count = coalesce((
    select sum(quantity)::bigint
    from public.sale_items
    where product_id = new.product_id
  ), 0)
  where id = new.product_id;

  return new;
end;
$$;

drop trigger if exists refresh_product_sales_count_trigger on public.sale_items;
create trigger refresh_product_sales_count_trigger
after insert or update of product_id, quantity or delete
on public.sale_items
for each row
execute function public.refresh_product_sales_count();

grant select (sales_count) on public.products to anon, authenticated;
