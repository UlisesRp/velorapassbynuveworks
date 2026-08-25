-- ============================================================
-- VELORA PASS V1.9.5
-- Cotización pública sin desglose de costos.
-- Ejecutar UNA VEZ en Supabase > SQL Editor.
--
-- NO borra cotizaciones, vouchers, firmas ni usuarios.
-- ============================================================

-- El RPC antiguo devolvía el payload interno completo.
-- Quitamos acceso anónimo a esa función.
revoke execute on function public.get_quote_by_token(uuid) from anon;

-- Nueva función pública sanitizada.
-- Entrega:
--   - datos generales de la cotización,
--   - servicios SIN importes individuales,
--   - total final.
-- NO entrega:
--   - amount de cada servicio,
--   - subtotal interno,
--   - cargo extra por MSI,
--   - anticipo.
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
      (
        q.payload
        - 'items'
        - 'baseTotal'
        - 'msiAmount'
        - 'deposit'
      )
      ||
      jsonb_build_object(
        'items',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'category', item ->> 'category',
                'concept', item ->> 'concept',
                'description', item ->> 'description'
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
  from public.quotes q
  where q.public_token = p_token
  limit 1;
$$;

revoke all on function public.get_public_quote_by_token(uuid) from public;
grant execute on function public.get_public_quote_by_token(uuid) to anon, authenticated;
