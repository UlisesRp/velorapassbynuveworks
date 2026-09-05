-- ============================================================
-- VELORA APP V2.3
-- PASAJEROS OBLIGATORIOS ANTES DE ENVIAR/FIRMAR UNA RESERVA
--
-- Ejecutar UNA VEZ en Supabase > SQL Editor.
-- No crea tablas ni columnas nuevas.
-- Los datos se guardan en reservations.payload (JSONB).
-- ============================================================

create or replace function public.reservation_passengers_complete(
  p_payload jsonb,
  p_traveler_count integer
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  p jsonb;
  expected_adults integer;
  expected_minors integer;
  actual_adults integer := 0;
  actual_minors integer := 0;
  passenger_count integer;
begin
  if jsonb_typeof(coalesce(p_payload -> 'passengers','null'::jsonb)) <> 'array' then
    return false;
  end if;

  expected_adults :=
    greatest(
      1,
      coalesce(
        case
          when coalesce(p_payload ->> 'adults','') ~ '^[0-9]+$'
            then (p_payload ->> 'adults')::int
        end,
        greatest(coalesce(p_traveler_count,1),1)
      )
    );

  expected_minors :=
    greatest(
      0,
      coalesce(
        case
          when coalesce(p_payload ->> 'minors','') ~ '^[0-9]+$'
            then (p_payload ->> 'minors')::int
        end,
        0
      )
    );

  if expected_adults + expected_minors <> greatest(coalesce(p_traveler_count,1),1) then
    return false;
  end if;

  passenger_count := jsonb_array_length(p_payload -> 'passengers');

  if passenger_count <> expected_adults + expected_minors then
    return false;
  end if;

  for p in
    select value from jsonb_array_elements(p_payload -> 'passengers')
  loop
    if length(trim(coalesce(p ->> 'name',''))) < 3 then
      return false;
    end if;

    if coalesce(p ->> 'type','') not in ('adult','minor') then
      return false;
    end if;

    if coalesce(p ->> 'age','') !~ '^[0-9]+$' then
      return false;
    end if;

    if p ->> 'type' = 'minor' then
      actual_minors := actual_minors + 1;
      if (p ->> 'age')::int < 0 or (p ->> 'age')::int > 12 then
        return false;
      end if;
    else
      actual_adults := actual_adults + 1;
      if (p ->> 'age')::int < 13 or (p ->> 'age')::int > 120 then
        return false;
      end if;
    end if;
  end loop;

  return actual_adults = expected_adults
     and actual_minors = expected_minors;
end;
$$;

revoke all on function public.reservation_passengers_complete(jsonb,integer) from public;
grant execute on function public.reservation_passengers_complete(jsonb,integer) to authenticated;

-- La reserva pública SOLO existe para el cliente cuando todos los pasajeros están completos.
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
          'adults',
            greatest(
              1,
              coalesce(
                case when coalesce(r.payload ->> 'adults','') ~ '^[0-9]+$'
                  then (r.payload ->> 'adults')::int end,
                r.traveler_count,
                1
              )
            ),
          'minors',
            greatest(
              0,
              coalesce(
                case when coalesce(r.payload ->> 'minors','') ~ '^[0-9]+$'
                  then (r.payload ->> 'minors')::int end,
                0
              )
            ),
          'passengers', coalesce(r.payload -> 'passengers','[]'::jsonb),
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
    and public.reservation_passengers_complete(r.payload, r.traveler_count)
  limit 1;
$$;

revoke all on function public.get_public_reservation_by_token(uuid) from public;
grant execute on function public.get_public_reservation_by_token(uuid) to anon, authenticated;

-- Segunda barrera: aunque alguien conserve un token, no puede firmar una reserva incompleta.
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
  target_payload jsonb;
  target_count integer;
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

  select payload, traveler_count
    into target_payload, target_count
  from public.reservations
  where public_token = p_token
  limit 1;

  if target_payload is null then
    return null;
  end if;

  if not public.reservation_passengers_complete(target_payload, target_count) then
    raise exception 'Completa nombre y edad de todos los pasajeros antes de firmar la reserva';
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
