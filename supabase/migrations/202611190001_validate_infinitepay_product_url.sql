-- Defense in depth: validate checkout URLs in PostgreSQL as well as in the UI.
-- Only HTTPS links hosted on the InfinitePay domains are accepted.
alter table public.products
  add constraint products_infinitepay_url_host_check
  check (
    infinitepay_product_url is null
    or infinitepay_product_url ~* '^https://([a-z0-9-]+\\.)*infinitepay\\.(io|com\\.br)(/|[?#]|$)'
  ) not valid;

alter table public.products
  validate constraint products_infinitepay_url_host_check;
