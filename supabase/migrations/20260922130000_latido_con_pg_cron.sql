-- El latido del recordatorio diario, dentro de Supabase.
--
-- POR QUÉ EXISTE ESTA ALTERNATIVA: el plan original lo disparaba un flujo de
-- Power Automate, pero su acción HTTP es Premium y no todas las licencias la
-- traen. El contrato es exactamente el mismo —un POST cada 15 minutos a
-- `daily-time-request`, que decide si toca— así que cambiar de disparador no
-- toca ni la función, ni la base, ni la aplicación. Si mañana aparece la
-- licencia, se borra el job y se arma el flujo; nada más cambia.
--
-- POR QUÉ SIGUE SIENDO UN LATIDO TONTO Y NO UN CRON CON LA HORA ADENTRO:
-- porque la hora es un dato que un administrador cambia desde Configuración.
-- Ponerla en la expresión cron la devolvería al lugar donde cambiarla exige
-- una migración, que es justo lo que se quiso evitar.
--
-- POR QUÉ CORRE LAS 24 HORAS: pg_cron evalúa la expresión en la zona horaria
-- del servidor, que en Supabase es UTC. Un `6-21` acá serían la 1 a. m. y las
-- 4 p. m. de Bogotá — un error que no se ve hasta que el recordatorio no sale.
-- Correr siempre y dejar que la base decida elimina esa clase de error
-- completa. El costo es nulo: cuando el recordatorio está apagado, esta
-- función devuelve sin hacer ninguna llamada HTTP.
--
-- REQUISITOS PREVIOS (una sola vez, desde el Dashboard de Supabase:
-- Database -> Extensions): habilitar `pg_cron` y `pg_net`. Y guardar dos
-- secretos en Vault, que NO pueden vivir en este archivo porque este archivo
-- está en git:
--
--   select vault.create_secret(
--     '<el mismo valor de TIME_REQUEST_SECRET>',
--     'time_request_secret',
--     'Secreto compartido con las Edge Functions del recordatorio de tiempos'
--   );
--   select vault.create_secret(
--     'https://<project-ref>.supabase.co/functions/v1',
--     'functions_base_url',
--     'Base de las Edge Functions del proyecto'
--   );

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception
      'Falta la extensión pg_cron. Habilítala en el Dashboard de Supabase (Database -> Extensions) y vuelve a aplicar esta migración.';
  end if;

  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception
      'Falta la extensión pg_net. Habilítala en el Dashboard de Supabase (Database -> Extensions) y vuelve a aplicar esta migración.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- El disparo
-- ---------------------------------------------------------------------------
-- Devuelve el id de la petición de pg_net, que es asíncrona: encola el POST y
-- sigue. La respuesta aterriza después en `net._http_response`, y ahí es donde
-- se mira cuando algo no sale (ver la consulta de diagnóstico al final).
create or replace function public.disparar_recordatorio_de_tiempos()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_base_url text;
  v_request_id bigint;
begin
  -- Cortocircuito barato: mientras el recordatorio esté apagado, los 96
  -- disparos diarios cuestan un select de una fila y ni una llamada de red.
  if not exists (
    select 1 from public.settings where id = 1 and time_request_enabled
  ) then
    return null;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'time_request_secret';

  select decrypted_secret into v_base_url
  from vault.decrypted_secrets where name = 'functions_base_url';

  if v_secret is null or v_base_url is null then
    raise exception
      'Faltan los secretos time_request_secret / functions_base_url en Vault (ver el encabezado de esta migración)';
  end if;

  select net.http_post(
    url := v_base_url || '/daily-time-request',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Webhook-Secret', v_secret
    ),
    body := '{}'::jsonb,
    -- Generoso a propósito: cuando SÍ toca, esa llamada sincroniza calendarios
    -- y encola un correo por persona. Un timeout corto cortaría el envío a la
    -- mitad, y la mitad del equipo se quedaría sin su recordatorio.
    timeout_milliseconds := 120000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.disparar_recordatorio_de_tiempos() from public;
revoke all on function public.disparar_recordatorio_de_tiempos() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- El reloj
-- ---------------------------------------------------------------------------
-- Se desprograma primero para que esta migración se pueda volver a aplicar
-- sin terminar con dos jobs haciendo lo mismo.
select cron.unschedule('latido-recordatorio-tiempos')
where exists (select 1 from cron.job where jobname = 'latido-recordatorio-tiempos');

select cron.schedule(
  'latido-recordatorio-tiempos',
  '*/15 * * * *',
  $$select public.disparar_recordatorio_de_tiempos();$$
);

-- ---------------------------------------------------------------------------
-- Para cuando algo no salga
-- ---------------------------------------------------------------------------
--   -- ¿Está programado?
--   select jobname, schedule, active from cron.job;
--
--   -- ¿Corrió? (las últimas ejecuciones y si fallaron)
--   select start_time, status, return_message
--   from cron.job_run_details
--   where jobname = 'latido-recordatorio-tiempos'
--   order by start_time desc limit 20;
--
--   -- ¿Qué contestó la Edge Function? `status_code` 200 y el cuerpo con
--   -- "skipped" es lo NORMAL: significa que todavía no es la hora.
--   select created, status_code, content
--   from net._http_response
--   order by created desc limit 10;
--
--   -- Disparar a mano, sin esperar los 15 minutos:
--   select public.disparar_recordatorio_de_tiempos();
