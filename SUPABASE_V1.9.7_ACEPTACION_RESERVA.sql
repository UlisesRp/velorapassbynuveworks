-- ============================================================
-- VELORA PASS V1.9.7
-- Flujo compartido de cotizaciones:
-- enviada > vista > aceptada > reserva creada
--
-- Ejecutar UNA VEZ en Supabase > SQL Editor.
-- NO borra cotizaciones, vouchers, firmas, usuarios ni auditoría.
-- ============================================================

-- 1. Guardar la aceptación del cliente.
alter table public.quotes
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by_name text;

-- 2. Permitir el nuevo estado "accepted".
alter table public.quotes
  drop constraint if exists quotes_status_check;

alter table public.quotes
  add constraint quotes_status_check
  check (status in ('draft','sent','viewed','accepted','converted'));

-- 3. Al abrir una cotización, NO bajar el estado si ya está aceptada o convertida.
create or replace function public.mark_quote_viewed(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.quotes
  set
    viewed_at = coalesce(viewed_at, now()),
    status = case
      when status in ('draft','sent') then 'viewed'
      else status
    end
  where public_token = p_token;
end;
$$;

revoke all on function public.mark_quote_viewed(uuid) from public;
grant execute on function public.mark_quote_viewed(uuid) to anon, authenticated;

-- 4. El cliente puede aceptar únicamente mediante el token público.
create or replace function public.accept_quote(
  p_token uuid,
  p_client_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  update public.quotes
  set
    status = case when status = 'converted' then 'converted' else 'accepted' end,
    accepted_at = coalesce(accepted_at, now()),
    accepted_by_name = coalesce(
      accepted_by_name,
      nullif(trim(p_client_name), '')
    )
  where public_token = p_token
  returning jsonb_build_object(
    'id', id,
    'status', status,
    'accepted_at', accepted_at,
    'accepted_by_name', accepted_by_name
  )
  into result;

  return result;
end;
$$;

revoke all on function public.accept_quote(uuid,text) from public;
grant execute on function public.accept_quote(uuid,text) to anon, authenticated;

-- 5. Mantener la cotización pública sanitizada y añadir solo el estado de aceptación.
create or replace function public.get_public_quote_by_token(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', q.id,
    'code', q.code,
    'public_token', q.public_token,
    'total', q.total,
    'status', q.status,
    'created_at', q.created_at,
    'accepted_at', q.accepted_at,
    'accepted_by_name', q.accepted_by_name,
    'payload',
      jsonb_strip_nulls(
        jsonb_build_object(
          'client', q.payload ->> 'client',
          'title', q.payload ->> 'title',
          'destination', q.payload ->> 'destination',
          'startDate', q.payload ->> 'startDate',
          'endDate', q.payload ->> 'endDate',
          'validUntil', q.payload ->> 'validUntil',
          'travelerCount', q.payload ->> 'travelerCount',
          'tripType', q.payload ->> 'tripType',
          'includes', q.payload ->> 'includes',
          'excludes', q.payload ->> 'excludes',
          'notes', q.payload ->> 'notes',
          'advisor', q.payload ->> 'advisor',
          'advisorWhatsapp', q.payload ->> 'advisorWhatsapp',
          'advisorEmail', q.payload ->> 'advisorEmail',

          'msiEnabled',
            (
              lower(coalesce(q.payload ->> 'msiEnabled', 'false'))
              in ('true','on','1','yes')
            ),

          'paymentDeadline',
            case
              when lower(coalesce(q.payload ->> 'msiEnabled', 'false')) in ('true','on','1','yes')
                then null
              else nullif(q.payload ->> 'paymentDeadline', '')
            end,

          'paymentMethods',
            case
              when lower(coalesce(q.payload ->> 'msiEnabled', 'false')) in ('true','on','1','yes')
                then null
              else nullif(q.payload ->> 'paymentMethods', '')
            end,

          'items',
            coalesce(
              (
                select jsonb_agg(
                  jsonb_strip_nulls(
                    jsonb_build_object(
                      'category', item ->> 'category',
                      'concept', item ->> 'concept',
                      'description', item ->> 'description',
                      'hotelImage', nullif(item ->> 'hotelImage', '')
                    )
                  )
                )
                from jsonb_array_elements(
                  coalesce(q.payload -> 'items', '[]'::jsonb)
                ) as item
              ),
              '[]'::jsonb
            )
        )
      )
  )
  from public.quotes q
  where q.public_token = p_token
  limit 1;
$$;

revoke all on function public.get_public_quote_by_token(uuid) from public;
grant execute on function public.get_public_quote_by_token(uuid) to anon, authenticated;
