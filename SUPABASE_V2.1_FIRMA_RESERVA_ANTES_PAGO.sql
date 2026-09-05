-- ============================================================
-- VELORA APP V2.1
-- FLUJO: COTIZACIÓN ACEPTADA -> RESERVA FIRMADA -> PAGO -> CONFIRMACIÓN
--
-- Ejecutar UNA VEZ en Supabase > SQL Editor.
-- NO borra cotizaciones, reservas, pagos, firmas, usuarios ni vouchers.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. Enlace público y firma de la reserva
-- ------------------------------------------------------------
alter table public.reservations
  add column if not exists public_token uuid,
  add column if not exists viewed_at timestamptz,
  add column if not exists signed_at timestamptz,
  add column if not exists signer_name text,
  add column if not exists signature_data text;

update public.reservations
set public_token = gen_random_uuid()
where public_token is null;

alter table public.reservations
  alter column public_token set default gen_random_uuid(),
  alter column public_token set not null;

create unique index if not exists reservations_public_token_uidx
on public.reservations(public_token);

-- ------------------------------------------------------------
-- 2. Lectura pública SEGURA de una reserva mediante token
--    No expone notas internas ni costos desglosados.
-- ------------------------------------------------------------
create or replace function public.get_public_reservation_by_token(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', r.id,
    'code', r.code,
    'public_token', r.public_token,
    'agency', r.agency,
    'client_name', r.client_name,
    'phone', r.phone,
    'email', r.email,
    'destination', r.destination,
    'start_date', r.start_date,
    'end_date', r.end_date,
    'traveler_count', r.traveler_count,
    'total', r.total,
    'status', r.status,
    'viewed_at', r.viewed_at,
    'signed_at', r.signed_at,
    'signer_name', r.signer_name,
    'signature_data', r.signature_data,
    'payload',
      jsonb_strip_nulls(
        jsonb_build_object(
          'tripType', r.payload ->> 'tripType',
          'quoteFolio', r.payload ->> 'quoteFolio',
          'quoteAcceptedAt', r.payload ->> 'quoteAcceptedAt',
          'msiEnabled',
            lower(coalesce(r.payload ->> 'msiEnabled','false')) in ('true','1','yes','on'),
          'paymentMethods', nullif(r.payload ->> 'paymentMethods',''),
          'includes', nullif(r.payload ->> 'includes',''),
          'excludes', nullif(r.payload ->> 'excludes',''),
          'services',
            coalesce(
              (
                select jsonb_agg(
                  jsonb_strip_nulls(
                    jsonb_build_object(
                      'category', item ->> 'category',
                      'concept', item ->> 'concept',
                      'description', item ->> 'description',
                      'hotelImage', nullif(item ->> 'hotelImage','')
                    )
                  )
                )
                from jsonb_array_elements(
                  case
                    when jsonb_typeof(r.payload -> 'services')='array'
                      then r.payload -> 'services'
                    else '[]'::jsonb
                  end
                ) item
              ),
              '[]'::jsonb
            )
        )
      )
  )
  from public.reservations r
  where r.public_token = p_token
  limit 1;
$$;

revoke all on function public.get_public_reservation_by_token(uuid) from public;
grant execute on function public.get_public_reservation_by_token(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 3. Marcar reserva como vista
-- ------------------------------------------------------------
create or replace function public.mark_reservation_viewed(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reservations
  set viewed_at = coalesce(viewed_at, now())
  where public_token = p_token;
end;
$$;

revoke all on function public.mark_reservation_viewed(uuid) from public;
grant execute on function public.mark_reservation_viewed(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 4. Firma de la reserva
--    La firma mueve el estatus a confirmed.
-- ------------------------------------------------------------
create or replace function public.sign_reservation(
  p_token uuid,
  p_signer_name text,
  p_signature_data text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if nullif(trim(p_signer_name),'') is null then
    raise exception 'Nombre de firma requerido';
  end if;

  if nullif(trim(p_signature_data),'') is null then
    raise exception 'Firma requerida';
  end if;

  update public.reservations
  set
    signed_at = coalesce(signed_at, now()),
    signer_name = coalesce(signer_name, trim(p_signer_name)),
    signature_data = coalesce(signature_data, p_signature_data),
    status = case
      when status = 'cancelled' then status
      when status = 'liquidated' then status
      else 'confirmed'
    end,
    updated_at = now()
  where public_token = p_token
    and status <> 'cancelled'
  returning jsonb_build_object(
    'id', id,
    'code', code,
    'status', status,
    'signed_at', signed_at,
    'signer_name', signer_name
  )
  into result;

  return result;
end;
$$;

revoke all on function public.sign_reservation(uuid,text,text) from public;
grant execute on function public.sign_reservation(uuid,text,text) to anon, authenticated;

-- ------------------------------------------------------------
-- 5. BLOQUEO REAL DE COBROS ANTES DE FIRMA
--    Aunque alguien intente insertar un pago desde consola,
--    Supabase rechazará el pago si la reserva no está firmada.
-- ------------------------------------------------------------
create or replace function public.require_signed_reservation_before_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation_signed_at timestamptz;
  reservation_status text;
begin
  select signed_at, status
    into reservation_signed_at, reservation_status
  from public.reservations
  where id = new.reservation_id;

  if reservation_status = 'cancelled' then
    raise exception 'No se pueden registrar pagos en una reserva cancelada';
  end if;

  if reservation_signed_at is null then
    raise exception 'La reserva debe estar firmada por el cliente antes de registrar pagos';
  end if;

  return new;
end;
$$;

drop trigger if exists require_reservation_signature_before_payment on public.payments;
create trigger require_reservation_signature_before_payment
before insert on public.payments
for each row
execute function public.require_signed_reservation_before_payment();

-- ------------------------------------------------------------
-- 6. Mantener estados coherentes:
--    reservas que YA tienen firma quedan Confirmadas salvo
--    que ya estén liquidadas o canceladas.
-- ------------------------------------------------------------
update public.reservations
set status='confirmed'
where signed_at is not null
  and status='pending';
