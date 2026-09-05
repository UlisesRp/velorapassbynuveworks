-- ============================================================
-- VELORA APP V2.1.1
-- Evidencia de aceptación de Políticas y Condiciones.
-- Ejecutar UNA VEZ en Supabase > SQL Editor.
--
-- NO borra reservas, cotizaciones, pagos, usuarios, firmas ni vouchers.
-- ============================================================

alter table public.reservations
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz;

-- Nueva firma de RPC con versión de términos.
-- La función anterior de 3 argumentos puede seguir existiendo para compatibilidad.
create or replace function public.sign_reservation(
  p_token uuid,
  p_signer_name text,
  p_signature_data text,
  p_terms_version text
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

  if nullif(trim(p_terms_version),'') is null then
    raise exception 'Versión de políticas requerida';
  end if;

  update public.reservations
  set
    signed_at = coalesce(signed_at, now()),
    signer_name = coalesce(signer_name, trim(p_signer_name)),
    signature_data = coalesce(signature_data, p_signature_data),
    terms_version = coalesce(terms_version, trim(p_terms_version)),
    terms_accepted_at = coalesce(terms_accepted_at, now()),
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
    'signer_name', signer_name,
    'terms_version', terms_version,
    'terms_accepted_at', terms_accepted_at
  )
  into result;

  return result;
end;
$$;

revoke all on function public.sign_reservation(uuid,text,text,text) from public;
grant execute on function public.sign_reservation(uuid,text,text,text) to anon, authenticated;

-- Añadir evidencia al RPC público para una reserva ya firmada.
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
    'terms_version', r.terms_version,
    'terms_accepted_at', r.terms_accepted_at,
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
