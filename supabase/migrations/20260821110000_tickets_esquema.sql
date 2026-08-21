-- Mesa de ayuda: un correo a soporte@ se convierte en un ticket del tablero.
--
-- FLUJO COMPLETO:
--   1. Cualquiera con correo @ceinfes.com escribe a la cuenta de soporte.
--   2. La cuenta reenvía al webhook, que crea la tarjeta SIN DUEÑO.
--   3. Se le responde al solicitante con el número de ticket.
--   4. La tarjeta le sale a TODOS los Analistas de Tecnología. Uno se la
--      asigna, o el Coordinador/Administrador se la asigna a quien toque.
--   5. Al pasarla a `completada`, el solicitante recibe el aviso de cierre.
--   6. Si responde a ese correo, el ticket se reabre con su comentario.
--
-- POR QUÉ UN TICKET ES UNA `task` Y NO UNA TABLA APARTE:
-- porque termina siendo trabajo de una persona en un tablero, que es
-- exactamente lo que ya modela `tasks`: tiene estado, responsable,
-- comentarios, historial y flujo de revisión. Una tabla paralela habría
-- duplicado el tablero, la RLS y el cronograma para no ganar nada. Lo único
-- propio del ticket son los cuatro campos de abajo.
--
-- EL CONTENEDOR (mes y proyecto):
-- `tasks.month_id` y `tasks.project_id` son NOT NULL, y el trabajo de
-- soporte no pertenece ni a un mes ni a un proyecto. Hacerlos nulos habría
-- arrastrado la RLS, las vistas de reporte, la grilla y `task_assignees`
-- entera. En vez de eso, los tickets viven en un proyecto contenedor fijo
-- ("Soporte") y en el mes donde el analista tenga fila de roster. Para quien
-- los trabaja es invisible: el tablero del Analista de Tecnología ya ignora
-- el mes y lo muestra como etiqueta (ver TareasPage).

-- ---------------------------------------------------------------------------
-- 1. Numeración visible
-- ---------------------------------------------------------------------------
-- Un uuid no se puede poner en el asunto de un correo ni dictar por teléfono.
-- La secuencia es independiente de la tabla: aunque se borre un ticket, su
-- número no se reutiliza — dos tickets distintos con el mismo número en dos
-- correos distintos sería peor que un hueco en la numeración.
create sequence if not exists public.ticket_number_seq as integer start with 1;

alter table public.tasks
  add column if not exists ticket_number integer,
  -- Quien pidió. NO es una FK a profiles: cualquiera del dominio puede
  -- escribir a soporte, tenga o no cuenta en la plataforma. Es la dirección
  -- a la que van el acuse y el aviso de cierre.
  add column if not exists requester_email text,
  -- `Message-ID` del correo que originó el ticket. Único: los proveedores de
  -- inbound reintentan el webhook cuando tarda en responder, y sin esto el
  -- mismo correo entra dos y tres veces. Es el bug clásico de estas
  -- integraciones y se previene acá, no en el código de la función.
  add column if not exists source_message_id text,
  -- Referencia del hilo, para que una respuesta caiga en el ticket que le
  -- corresponde en vez de abrir uno nuevo.
  add column if not exists thread_reference text;

create unique index if not exists tasks_ticket_number_idx
  on public.tasks (ticket_number) where ticket_number is not null;

create unique index if not exists tasks_source_message_idx
  on public.tasks (source_message_id) where source_message_id is not null;

create index if not exists tasks_thread_reference_idx
  on public.tasks (thread_reference) where thread_reference is not null;

-- Un ticket es una tarea con número. El predicado se usa en las políticas de
-- abajo y en el frontend, y evita que "es de soporte" se deduzca comparando
-- contra el id del proyecto contenedor en quince sitios distintos.
create or replace function public.is_ticket(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tasks
    where id = p_task_id and ticket_number is not null
  );
$$;

revoke all on function public.is_ticket(uuid) from public;
grant execute on function public.is_ticket(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Dónde viven los tickets
-- ---------------------------------------------------------------------------
-- El proyecto contenedor se guarda en `settings` y no se codifica en la
-- función: si mañana se renombra o se decide moverlos, se cambia el ajuste y
-- no una migración.
alter table public.settings
  add column if not exists support_project_id uuid
    references public.projects (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 3. Bandeja de salida
-- ---------------------------------------------------------------------------
-- Los correos NO se envían desde el trigger. Un trigger que llama a un
-- servicio externo ata el commit de la base a que un tercero responda: si
-- Postmark tarda, la transacción se cuelga; si falla, o se pierde el correo o
-- se revierte el cierre del ticket. Ninguna de las dos es aceptable.
--
-- En vez de eso el trigger encola, y un worker aparte envía y marca. Si el
-- proveedor está caído, la fila espera y se reintenta. Ningún acuse perdido,
-- ningún aviso de cierre que nunca salió.
create table if not exists public.outbox (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks (id) on delete set null,
  kind text not null check (kind in ('ticket_creado', 'ticket_cerrado', 'ticket_reabierto')),
  to_email text not null,
  subject text not null,
  body text not null,
  -- Para que el hilo del correo se mantenga del lado del solicitante.
  thread_reference text,
  sent_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

-- El worker solo pregunta por lo pendiente; el índice parcial mantiene esa
-- consulta barata aunque la tabla acumule meses de correos ya enviados.
create index if not exists outbox_pending_idx
  on public.outbox (created_at) where sent_at is null;

alter table public.outbox enable row level security;
revoke all on public.outbox from anon;

-- Nadie escribe acá desde el cliente: encolan los triggers (SECURITY
-- DEFINER) y vacía el worker (service role, que no pasa por RLS). Los
-- administradores pueden mirar para diagnosticar un correo que no llegó.
grant select on public.outbox to authenticated;

drop policy if exists "outbox_select_admin" on public.outbox;
create policy "outbox_select_admin" on public.outbox
  for select to authenticated using (public.is_admin());
