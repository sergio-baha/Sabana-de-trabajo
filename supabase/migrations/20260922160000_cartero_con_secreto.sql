-- El cartero se identifica con el secreto compartido, no con la anon key.
--
-- POR QUÉ CAMBIA: este proyecto usa el formato NUEVO de llaves de Supabase
-- (`sb_publishable_…`), que no es un JWT. La puerta de las Edge Functions
-- valida el encabezado Authorization como JWT y lo rechaza con
-- UNAUTHORIZED_INVALID_JWT_FORMAT, así que no hay ninguna llave del proyecto
-- que sirva para que pg_net invoque una función con verify_jwt activo.
--
-- La salida es la que ya usan las otras funciones del circuito: verify_jwt
-- desactivado y autenticación propia con `TIME_REQUEST_SECRET` en un
-- encabezado. `outbox-worker` ahora comprueba ese secreto.
--
-- Esto además deja el diseño más coherente: los tres llamadores internos
-- —el latido del recordatorio, el del outbox y la sincronización de
-- calendario— se identifican todos igual, en vez de tener uno con JWT y dos
-- con secreto.
--
-- `anon_key` en Vault queda sin uso. Se puede borrar con
--   select vault.delete_secret(id) from vault.secrets where name = 'anon_key';
-- pero no lo hace esta migración: borrar secretos de nadie más es una
-- decisión de quien opera el proyecto, no de un despliegue.

create or replace function public.disparar_outbox()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_url text;
  v_secret text;
  v_request_id bigint;
begin
  -- Mismo tope de intentos que outbox-worker (MAX_ATTEMPTS = 5): una fila
  -- agotada no cuenta como pendiente, o el cartero saldría cada minuto por
  -- una dirección que no existe.
  if not exists (
    select 1 from public.outbox where sent_at is null and attempts < 5
  ) then
    return null;
  end if;

  select decrypted_secret into v_base_url
  from vault.decrypted_secrets where name = 'functions_base_url';

  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'time_request_secret';

  if v_base_url is null or v_secret is null then
    raise exception
      'Faltan los secretos functions_base_url / time_request_secret en Vault';
  end if;

  select net.http_post(
    url := v_base_url || '/outbox-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Webhook-Secret', v_secret
    ),
    body := '{}'::jsonb,
    -- El worker manda de a 25 por tanda; con Postmark lento, eso tarda.
    timeout_milliseconds := 60000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.disparar_outbox() from public;
revoke all on function public.disparar_outbox() from anon, authenticated;
