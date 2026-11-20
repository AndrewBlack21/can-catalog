-- Link individual da Loja Online InfinitePay por produto.
-- O campo é opcional: produtos sem link continuam usando o fluxo atual do CAN.
alter table public.products
  add column if not exists infinitepay_product_url text;

comment on column public.products.infinitepay_product_url is
  'URL HTTPS individual do produto na Loja Online InfinitePay. NULL mantém o checkout externo oculto.';
