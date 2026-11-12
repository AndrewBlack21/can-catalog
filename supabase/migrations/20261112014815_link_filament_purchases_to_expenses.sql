alter table public.can_expenses
  add column if not exists filament_type_id uuid
  references public.filament_types(id) on delete set null;

create index if not exists can_expenses_filament_type_id_idx
  on public.can_expenses(filament_type_id);

grant select on public.filament_types to authenticated;
