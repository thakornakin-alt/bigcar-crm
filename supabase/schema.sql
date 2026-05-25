create table if not exists public.big_car_crm_store (
  store_key text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.big_car_crm_store enable row level security;

revoke all on table public.big_car_crm_store from anon;
revoke all on table public.big_car_crm_store from authenticated;

grant select, insert, update, delete on table public.big_car_crm_store to service_role;

create index if not exists big_car_crm_store_updated_at_idx
  on public.big_car_crm_store (updated_at desc);
