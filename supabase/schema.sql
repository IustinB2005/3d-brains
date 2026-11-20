-- 3D Brains database schema for Supabase.
-- Run once: Supabase dashboard → SQL Editor → New query → paste → Run.
-- Every table is private per user thanks to Row Level Security.

create extension if not exists pgcrypto;

create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  business_name text default '',
  currency text default 'RON',
  electricity_price numeric default 1.3,
  labor_rate numeric default 30,
  markup numeric default 100,
  failure_rate numeric default 5,
  updated_at timestamptz default now()
);

create table if not exists public.printers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  model text,
  power_w numeric default 0,
  purchase_price numeric default 0,
  lifetime_hours numeric default 5000,
  maintenance_per_hour numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz
);

create table if not exists public.filaments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  brand text,
  material text default 'PLA',
  color text,
  color_hex text,
  price_per_kg numeric default 0,
  spool_weight_g numeric default 1000,
  remaining_g numeric default 1000,
  created_at timestamptz default now(),
  updated_at timestamptz
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  customer text,
  status text not null default 'queued'
    check (status in ('quote','queued','printing','done','delivered','cancelled')),
  source text default 'custom',
  source_url text,
  thumbnail_url text,
  printer_id uuid references public.printers on delete set null,
  materials jsonb not null default '[]',
  quantity int default 1,
  print_minutes numeric default 0,
  labor_minutes numeric default 0,
  extra_costs numeric default 0,
  price numeric,
  paid boolean default false,
  order_date date default current_date,
  due_date date,
  notes text,
  costs jsonb,
  cost_total numeric,
  stock_deducted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz
);

create index if not exists orders_user_date on public.orders (user_id, order_date desc);
create index if not exists filaments_user on public.filaments (user_id);
create index if not exists printers_user on public.printers (user_id);

alter table public.settings  enable row level security;
alter table public.printers  enable row level security;
alter table public.filaments enable row level security;
alter table public.orders    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['settings','printers','filaments','orders'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Table privileges for signed-in users. Newer Supabase projects don't grant
-- these automatically for tables created in the SQL editor. RLS above still
-- limits every user to their own rows. The anonymous role gets nothing.
grant usage on schema public to authenticated;
grant select, insert, update, delete
  on public.settings, public.printers, public.filaments, public.orders
  to authenticated;
