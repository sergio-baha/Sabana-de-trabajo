-- Circuito de entrega y revisión (Fase 1 del plan).
--
-- Regla central: un Analista deja de poder cerrar una tarea por su cuenta.
-- Su última acción es enviarla a revisión; quien la cierra es el gestor del
-- proyecto. La regla vive acá y no solo en la interfaz: si viviera solo en
-- el cliente, cualquiera con la consola abierta la saltaría — y esta
-- herramienta mide desempeño.
--
-- Tres excepciones, decididas con el equipo:
--   1. El Analista de Tecnología queda FUERA del circuito. Su flujo es "solo
--      lo mío", no tiene gerente de proyecto y cierra sus tareas él mismo.
--   2. Si el proyecto lo creó la misma persona, tampoco hay revisión: nadie
--      se revisa a sí mismo.
--   3. Gestor y Administrador cierran directo, como hasta ahora.

-- ---------------------------------------------------------------------------
-- 1. Trazabilidad de la entrega
-- ---------------------------------------------------------------------------
alter table public.tasks
  add column submitted_at timestamptz,
  add column submitted_by uuid references public.profiles (id) on delete set null,
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references public.profiles (id) on delete set null,
  -- Cuántas veces volvió del gestor. Es dato de calidad, no castigo: sirve
  -- para ver si un tipo de trabajo necesita mejor definición inicial.
  add column returned_count smallint not null default 0;

-- ---------------------------------------------------------------------------
-- 2. ¿Esta persona necesita revisión para cerrar esta tarea?
-- ---------------------------------------------------------------------------
create or replace function public.task_requires_review(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- Solo los Analistas "a secas" entran al circuito...
    public.is_analista_role()
    and not public.is_analista_tecnologia()
    -- ...y solo cuando el proyecto no es suyo.
    and not exists (
      select 1 from public.projects pr
      where pr.id = p_project_id and pr.created_by = auth.uid()
    );
$$;

revoke all on function public.task_requires_review(uuid) from public;
grant execute on function public.task_requires_review(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Reglas de transición + sellado de fechas
-- ---------------------------------------------------------------------------
create or replace function public.tg_task_review_flow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sin cambio de estado no hay nada que revisar. Y sin sesión (RPC de
  -- clonado de mes, migraciones) tampoco se aplica el circuito.
  if new.status is not distinct from old.status or auth.uid() is null then
    return new;
  end if;

  if new.status = 'completada' and public.task_requires_review(new.project_id) then
    raise exception 'Esta tarea la cierra el gestor del proyecto. Envíala a revisión.'
      using errcode = 'check_violation';
  end if;

  if new.status = 'en_revision' then
    new.submitted_at := now();
    new.submitted_by := auth.uid();
    new.reviewed_at := null;
    new.reviewed_by := null;
  end if;

  if old.status = 'en_revision' and new.status <> 'en_revision' then
    new.reviewed_at := now();
    new.reviewed_by := auth.uid();
    -- Devolver = sacarla de revisión sin cerrarla.
    if new.status <> 'completada' then
      new.returned_count := coalesce(old.returned_count, 0) + 1;
    end if;
  end if;

  return new;
end;
$$;

create trigger task_review_flow
  before update on public.tasks
  for each row execute function public.tg_task_review_flow();

-- ---------------------------------------------------------------------------
-- 4. Comentarios de tarea
-- ---------------------------------------------------------------------------
-- Los `comments` que ya existían cuelgan de `allocations`: son notas de una
-- celda de la grilla, no de la tarea. Sin un hilo en la tarea, devolver un
-- trabajo sin poder decir por qué manda la conversación fuera de la
-- plataforma — por eso esto es requisito del circuito, no un extra.
create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);

create index task_comments_task_idx on public.task_comments (task_id, created_at);

alter table public.task_comments enable row level security;
revoke all on public.task_comments from anon;
grant select, insert, delete on public.task_comments to authenticated;

-- Se comenta lo que se puede ver: la visibilidad la hereda de `tasks`, cuyo
-- RLS ya resuelve quién ve qué. El `exists` se evalúa con los permisos de
-- quien consulta, así que no hay que repetir el criterio.
create policy "task_comments_select" on public.task_comments
  for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_comments.task_id));

create policy "task_comments_insert" on public.task_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.tasks t where t.id = task_comments.task_id)
  );

-- Solo el autor borra lo suyo. Un comentario de revisión no debería poder
-- desaparecer por mano ajena.
create policy "task_comments_delete_own" on public.task_comments
  for delete to authenticated using (author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. Notificaciones (solo dentro de la plataforma, sin correo)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('revision_pendiente', 'tarea_aprobada', 'tarea_devuelta')),
  task_id uuid references public.tasks (id) on delete cascade,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_inbox_idx
  on public.notifications (recipient_id, read_at, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon;
grant select, update, delete on public.notifications to authenticated;

-- Nadie lee el buzón ajeno. El insert no se concede a `authenticated`: las
-- crea el trigger (SECURITY DEFINER), para que nadie pueda fabricarle un
-- aviso a otra persona.
create policy "notifications_select_own" on public.notifications
  for select to authenticated using (recipient_id = auth.uid());

create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy "notifications_delete_own" on public.notifications
  for delete to authenticated using (recipient_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6. Quién se entera de qué
-- ---------------------------------------------------------------------------
create or replace function public.tg_task_review_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text;
  v_project text;
begin
  if new.status is not distinct from old.status or auth.uid() is null then
    return null;
  end if;

  select full_name into v_actor from public.profiles where id = auth.uid();
  select name into v_project from public.projects where id = new.project_id;

  -- Entregada: se avisa a los gerentes del proyecto que tengan cuenta.
  -- Si el proyecto no tiene gerente asignado, la entrega queda huérfana y no
  -- le aparece a nadie — decisión explícita del equipo. Ver la nota de
  -- seguimiento en el plan: esas tareas hay que rastrearlas por la columna
  -- "En revisión" del tablero.
  if new.status = 'en_revision' then
    insert into public.notifications (recipient_id, kind, task_id, title, body)
    select distinct pe.profile_id,
           'revision_pendiente',
           new.id,
           'Tarea por revisar: ' || new.title,
           coalesce(v_actor, 'Alguien') || ' entregó una tarea de ' || coalesce(v_project, 'un proyecto')
    from public.project_managers pm
    join public.people pe on pe.id = pm.person_id
    where pm.project_id = new.project_id
      and pe.profile_id is not null
      and pe.profile_id <> auth.uid();

  -- Revisada: se le avisa a quien la entregó (si no es quien revisa).
  elsif old.status = 'en_revision' and new.submitted_by is not null
        and new.submitted_by <> auth.uid() then
    insert into public.notifications (recipient_id, kind, task_id, title, body)
    values (
      new.submitted_by,
      case when new.status = 'completada' then 'tarea_aprobada' else 'tarea_devuelta' end,
      new.id,
      case when new.status = 'completada'
        then 'Aprobada: ' || new.title
        else 'Devuelta: ' || new.title end,
      coalesce(v_actor, 'El gestor') ||
        case when new.status = 'completada'
          then ' aprobó tu entrega'
          else ' pidió ajustes. Revisa los comentarios de la tarea' end
    );
  end if;

  return null;
end;
$$;

create trigger task_review_notify
  after update on public.tasks
  for each row execute function public.tg_task_review_notify();

-- Avisos en vivo: la campana se actualiza sola, sin recargar.
alter publication supabase_realtime add table public.notifications;
