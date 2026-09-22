-- Quien vacía la bandeja de salida.
--
-- EL AGUJERO QUE TAPA: `public.outbox` existe desde *_tickets_correo.sql y
-- `outbox-worker` desde entonces también, pero nunca se programó nada que
-- llamara al worker. El resultado es que ningún correo de la plataforma
-- llegó jamás: las filas se acumularon en la tabla, calladas, durante
-- semanas. El diseño de bandeja de salida es correcto —no atar el commit de
-- una transacción a que responda Postmark— pero una bandeja de salida sin
-- cartero es una tabla de correos que nadie va a leer.
--
-- POR QUÉ ESTABA ASÍ: el comentario de la Edge Function decía "se invoca por
-- cron (pg_cron o el scheduler de Supabase)", y esa frase se quedó como una
-- intención. La lección es la de siempre: si una pieza depende de algo que
-- vive fuera del repositorio, tarde o temprano ese algo no está. Ahora el
-- cartero es una migración, y se despliega con todo lo demás.
--
-- POR QUÉ CADA MINUTO: es el ritmo de un acuse de recibo. Un ticket cerrado
-- cuyo aviso llega cinco minutos después ya no se siente como respuesta.
--
-- POR QUÉ NO LLAMA SIEMPRE: con la bandeja vacía —que es el caso la mayor
-- parte del día— la función corta antes de salir a la red. 1.440 llamadas
-- diarias en vacío no le hacen daño a nadie, pero tampoco hay razón para
-- hacerlas.
--
-- REQUISITO PREVIO: el secreto `anon_key` en Vault. La anon key es pública
-- (viaja en el bundle del frontend), pero igual no se escribe en una
-- migración: los valores no van en git, ni siquiera los que no son secretos,
-- porque la próxima vez la costumbre se aplica a uno que sí lo es.
--
--   select vault.create_secret('<la anon key del proyecto>', 'anon_key',
--     'Anon key, para que pg_net pueda invocar Edge Functions con verify_jwt');

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'Falta la extensión pg_cron. Habilítala en Database -> Extensions.';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'Falta la extensión pg_net. Habilítala en Database -> Extensions.';
  end if;
end;
$$;

create or replace function public.disparar_outbox()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_url text;
  v_anon text;
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

  select decrypted_secret into v_anon
  from vault.decrypted_secrets where name = 'anon_key';

  if v_base_url is null or v_anon is null then
    raise exception
      'Faltan los secretos functions_base_url / anon_key en Vault (ver el encabezado de esta migración)';
  end if;

  select net.http_post(
    url := v_base_url || '/outbox-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      -- La anon key sirve de JWT si la función se desplegó con verify_jwt
      -- activo, y se ignora si no. Así el cartero funciona en cualquiera de
      -- los dos casos, sin tener que averiguar cuál es.
      'Authorization', 'Bearer ' || v_anon,
      'apikey', v_anon
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

select cron.unschedule('latido-del-outbox')
where exists (select 1 from cron.job where jobname = 'latido-del-outbox');

select cron.schedule(
  'latido-del-outbox',
  '* * * * *',
  $$select public.disparar_outbox();$$
);

-- ---------------------------------------------------------------------------
-- Para cuando un correo no llegue
-- ---------------------------------------------------------------------------
--   -- Lo que está esperando salir:
--   select kind, to_email, subject, attempts, last_error, created_at
--   from public.outbox where sent_at is null order by created_at;
--
--   -- Qué contestó Postmark:
--   select created, status_code, content
--   from net._http_response order by created desc limit 10;
--
--   -- Mandar la tanda ahora, sin esperar al minuto:
--   select public.disparar_outbox();
