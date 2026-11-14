alter table public.campaigns
  add column if not exists banner_path text,
  add column if not exists theme_colors jsonb not null default '{}'::jsonb;

alter table public.campaigns
  add constraint campaigns_theme_colors_object
  check (jsonb_typeof(theme_colors) = 'object');
