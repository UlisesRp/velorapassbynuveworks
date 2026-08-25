-- ============================================================
-- VELORA PASS V1.9.6
-- Cotización pública: imagen de hotel + modos de pago.
-- Ejecutar UNA VEZ en Supabase > SQL Editor.
--
-- NO borra cotizaciones, vouchers, firmas, usuarios ni auditoría.
-- Solo reemplaza la función pública que arma la cotización.
-- ============================================================

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
