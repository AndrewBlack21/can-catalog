create table if not exists public.can_expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 160),
  category text not null check (category in ('materials','printer_parts','filament','maintenance','packaging','tools','other')),
  description text,
  supplier text,
  purchase_date date not null default current_date,
  total_amount numeric(12,2) not null check (total_amount >= 0),
  payment_method text not null check (payment_method in ('credit','debit','pix','cash','transfer')),
  installments_count integer not null default 1 check (installments_count between 1 and 48),
  installments_paid integer not null default 0 check (installments_paid between 0 and installments_count),
  first_due_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint can_expenses_payment_installments_check check (
    (payment_method = 'credit')
    or (installments_count = 1 and installments_paid = 1)
  )
);
create index if not exists can_expenses_purchase_date_idx on public.can_expenses(purchase_date desc);
create index if not exists can_expenses_category_idx on public.can_expenses(category);
create index if not exists can_expenses_payment_method_idx on public.can_expenses(payment_method);
alter table public.can_expenses enable row level security;
revoke all on public.can_expenses from anon, authenticated;
grant select, insert, update, delete on public.can_expenses to authenticated;
create policy "CAN admins manage expenses"
on public.can_expenses for all to authenticated
using (exists (select 1 from public.catalog_admins ca where ca.user_id = (select auth.uid())))
with check (exists (select 1 from public.catalog_admins ca where ca.user_id = (select auth.uid())));