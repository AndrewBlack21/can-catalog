alter table public.product_print_details
  add column if not exists print_time_hours integer,
  add column if not exists print_time_minutes integer;

alter table public.product_print_details
  drop constraint if exists product_print_details_print_time_hours_check,
  add constraint product_print_details_print_time_hours_check
    check (print_time_hours is null or print_time_hours >= 0),
  drop constraint if exists product_print_details_print_time_minutes_check,
  add constraint product_print_details_print_time_minutes_check
    check (print_time_minutes is null or (print_time_minutes >= 0 and print_time_minutes <= 59));
