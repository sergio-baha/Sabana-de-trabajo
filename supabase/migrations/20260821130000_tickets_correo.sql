-- Los tres correos del ciclo de vida de un ticket: acuse, cierre, reapertura.
--
-- QUIÉN REDACTA: la base. Los triggers arman asunto y cuerpo y los dejan en
-- `outbox`; el worker solo transporta. Se hace así porque quien sabe QUÉ pasó
-- es la transacción que lo hizo — el cambio de estado, el número, el título.
-- Si el texto se armara en la Edge Function, tendría que volver a consultar
-- la tarea y adivinar por qué la están notificando.
--
-- EL ASUNTO ES LA CLAVE DEL HILO: todos llevan `[#123]` al principio. Cuando
-- el solicitante responde, el asunto vuelve con ese marcador y es lo que
-- permite reconectar la respuesta con su ticket aunque el cliente de correo
-- pierda las cabeceras `In-Reply-To`. Outlook y Gmail las conservan; los
-- reenvíos manuales y los webmails corporativos, no siempre.

-- ---------------------------------------------------------------------------
-- 1. El número se asigna solo
-- ---------------------------------------------------------------------------
-- Una tarea con solicitante ES un ticket, y todo ticket tiene número. Se
-- resuelve en un trigger y no en la Edge Function para que sea imposible
-- insertar un ticket sin numerar — aunque mañana entren por otra vía.
create or replace function public.tg_ticket_asigna_numero()
returns trigger
language plpgsql
as $$
begin
  if new.requester_email is not null and new.ticket_number is null then
    new.ticket_number := nextval('public.ticket_number_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists ticket_asigna_numero on public.tasks;

create trigger ticket_asigna_numero
  before insert on public.tasks
  for each row execute function public.tg_ticket_asigna_numero();

-- ---------------------------------------------------------------------------
-- 2. Acuse de recibo
-- ---------------------------------------------------------------------------
create or replace function public.tg_ticket_creado_notifica()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ticket_number is null or new.requester_email is null then
    return null;
  end if;

  insert into public.outbox (task_id, kind, to_email, subject, body, thread_reference)
  values (
    new.id,
    'ticket_creado',
    new.requester_email,
    '[#' || new.ticket_number || '] ' || new.title,
    'Recibimos tu solicitud y quedó registrada con el número ' ||
      new.ticket_number || '.' || chr(10) || chr(10) ||
      'Un analista de tecnología la va a tomar. Te avisamos por este mismo ' ||
      'correo cuando quede resuelta.' || chr(10) || chr(10) ||
      'Si necesitas agregar algo, responde a este mensaje sin cambiar el ' ||
      'asunto: lo que escribas se suma al ticket.',
    new.thread_reference
  );

  return null;
end;
$$;

drop trigger if exists ticket_creado_notifica on public.tasks;

create trigger ticket_creado_notifica
  after insert on public.tasks
  for each row execute function public.tg_ticket_creado_notifica();

-- ---------------------------------------------------------------------------
-- 3. Cierre y reapertura
-- ---------------------------------------------------------------------------
-- El cierre es `completada`, que ya existe como columna del tablero — no hizo
-- falta inventar un estado nuevo. La reapertura es salir de ahí, venga del
-- analista o de una respuesta del solicitante.
--
-- Se compara el estado viejo contra el nuevo: sin eso, cualquier edición de
-- una tarjeta ya cerrada (corregir el título, añadir horas) volvería a
-- disparar el correo de cierre.
create or replace function public.tg_ticket_estado_notifica()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cierre text;
begin
  if new.ticket_number is null or new.requester_email is null then
    return null;
  end if;

  if new.status is not distinct from old.status then
    return null;
  end if;

  if new.status = 'completada' then
    -- El último comentario del analista explica el cierre. Si no escribió
    -- nada, el correo sale igual: obligar a comentar para poder cerrar
    -- convertiría el aviso en un estorbo y la gente dejaría de cerrar.
    select body into v_cierre
    from public.task_comments
    where task_id = new.id
    order by created_at desc
    limit 1;

    insert into public.outbox (task_id, kind, to_email, subject, body, thread_reference)
    values (
      new.id,
      'ticket_cerrado',
      new.requester_email,
      '[#' || new.ticket_number || '] ' || new.title,
      'Tu ticket ' || new.ticket_number || ' quedó cerrado.' ||
        coalesce(chr(10) || chr(10) || 'Nota del analista:' || chr(10) || v_cierre, '') ||
        chr(10) || chr(10) ||
        'Si el problema sigue, responde a este correo sin cambiar el asunto ' ||
        'y el ticket se reabre con lo que escribas.',
      new.thread_reference
    );

  elsif old.status = 'completada' then
    insert into public.outbox (task_id, kind, to_email, subject, body, thread_reference)
    values (
      new.id,
      'ticket_reabierto',
      new.requester_email,
      '[#' || new.ticket_number || '] ' || new.title,
      'Tu ticket ' || new.ticket_number || ' se reabrió y volvió a la cola ' ||
        'de soporte.' || chr(10) || chr(10) ||
        'Te avisamos cuando vuelva a cerrarse.',
      new.thread_reference
    );
  end if;

  return null;
end;
$$;

drop trigger if exists ticket_estado_notifica on public.tasks;

create trigger ticket_estado_notifica
  after update on public.tasks
  for each row execute function public.tg_ticket_estado_notifica();

-- ---------------------------------------------------------------------------
-- 4. Aviso interno de ticket nuevo
-- ---------------------------------------------------------------------------
-- `notifications.kind` tenía un CHECK con los tres avisos del flujo de
-- revisión. Un ticket que entra sin dueño no le pertenece a nadie todavía, y
-- sin campana la bandeja se convierte en un buzón que nadie mira.
alter table public.notifications drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'revision_pendiente', 'tarea_aprobada', 'tarea_devuelta',
    'ticket_nuevo'
  ));

-- Le suena a todo Analista de Tecnología activo, que es justo quien puede
-- tomarlo. El Coordinador no recibe aviso por cada ticket: reparte lo que
-- quede sin tomar, y para eso mira la bandeja, no el buzón.
create or replace function public.tg_ticket_avisa_soporte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ticket_number is null then
    return null;
  end if;

  insert into public.notifications (recipient_id, kind, task_id, title, body)
  select p.id,
         'ticket_nuevo',
         new.id,
         'Ticket #' || new.ticket_number || ': ' || new.title,
         'Sin asignar. Llegó de ' || coalesce(new.requester_email, 'un solicitante') || '.'
  from public.profiles p
  where p.role = 'analista_tecnologia' and p.is_active;

  return null;
end;
$$;

drop trigger if exists ticket_avisa_soporte on public.tasks;

create trigger ticket_avisa_soporte
  after insert on public.tasks
  for each row execute function public.tg_ticket_avisa_soporte();
