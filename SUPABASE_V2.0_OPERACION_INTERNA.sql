-- ============================================================
-- VELORA APP V2.0 · OPERACIÓN INTERNA TIPO AuRA
-- Ejecutar UNA VEZ en Supabase > SQL Editor.
--
-- NO borra cotizaciones, vouchers/confirmaciones, firmas, usuarios
-- ni registros anteriores. Añade módulos internos de operación.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  agency text not null default 'Velora Travel',
  full_name text not null,
  phone text,
  email text,
  adults integer not null default 1 check (adults >= 0),
  minors integer not null default 0 check (minors >= 0),
  notes text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default (
    'RES-' || to_char(now(),'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))
  ),
  agency text not null default 'Velora Travel',
  client_id uuid references public.clients(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  client_name text not null,
  phone text,
  email text,
  destination text not null,
  start_date date not null,
  end_date date not null,
  traveler_count integer not null default 1 check (traveler_count >= 1),
  total numeric(12,2) not null default 0 check (total >= 0),
  status text not null default 'pending' check (status in ('pending','confirmed','liquidated','cancelled')),
  requires_invoice boolean not null default false,
  notes text,
  payload jsonb not null default '{}'::jsonb,
  voucher_id uuid references public.vouchers(id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method text,
  paid_at date not null default current_date,
  reference text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  agency text not null default 'Velora Travel',
  title text not null,
  event_date date not null,
  event_time time,
  event_type text not null default 'Seguimiento',
  client_name text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- Una cotización ahora se enlaza con una reserva interna, sin tocar
-- el campo histórico converted_voucher_id.
alter table public.quotes
  add column if not exists converted_reservation_id uuid references public.reservations(id) on delete set null;

-- RLS: aplicación privada. Todos los usuarios autenticados autorizados
-- pueden ver y operar los registros de ambas agencias.
alter table public.clients enable row level security;

drop policy if exists "authenticated_manage_clients" on public.clients;
create policy "authenticated_manage_clients"
on public.clients
for all
to authenticated
using (true)
with check (true);

alter table public.reservations enable row level security;

drop policy if exists "authenticated_manage_reservations" on public.reservations;
create policy "authenticated_manage_reservations"
on public.reservations
for all
to authenticated
using (true)
with check (true);

alter table public.payments enable row level security;

drop policy if exists "authenticated_manage_payments" on public.payments;
create policy "authenticated_manage_payments"
on public.payments
for all
to authenticated
using (true)
with check (true);

alter table public.events enable row level security;

drop policy if exists "authenticated_manage_events" on public.events;
create policy "authenticated_manage_events"
on public.events
for all
to authenticated
using (true)
with check (true);

create index if not exists clients_agency_idx on public.clients(agency);
create index if not exists clients_name_idx on public.clients(full_name);
create index if not exists reservations_start_idx on public.reservations(start_date);
create index if not exists reservations_agency_idx on public.reservations(agency);
create index if not exists reservations_status_idx on public.reservations(status);
create index if not exists payments_reservation_idx on public.payments(reservation_id);
create index if not exists payments_paid_at_idx on public.payments(paid_at);
create index if not exists events_date_idx on public.events(event_date);
