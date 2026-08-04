-- Convierte `tasks` (hasta ahora una lista mínima sin UI propia) en el
-- backlog/tablero del módulo Tareas, con el vocabulario de Azure DevOps
-- Boards: tipo de work item, prioridad, jerarquía padre/hijo, etiquetas y
-- estimación vs. horas trabajadas.
--
-- Sigue siendo un seguimiento cualitativo: `estimated_hours` y
-- `completed_hours` son del work item y NO entran en el cálculo de horas
-- asignadas del mes (eso lo siguen definiendo allocations/activities). Se
-- separan a propósito para que mover una tarjeta en el tablero nunca altere
-- la distribución de horas.

-- Tipos de work item, de mayor a menor granularidad. 'epica' agrupa
-- historias/tareas; 'bug' y 'tarea' son hojas típicas.
create type public.work_item_type as enum ('epica', 'historia', 'tarea', 'bug');

alter table public.tasks
  -- Tipo de work item; 'tarea' es el default para que las filas creadas
  -- antes de este módulo (y las copiadas por create_month_from_previous)
  -- sigan siendo válidas.
  add column work_item_type public.work_item_type not null default 'tarea',
  -- 1 = crítica … 4 = baja, la misma escala de Azure DevOps.
  add column priority smallint not null default 3 check (priority between 1 and 4),
  -- Posición dentro de su columna del tablero. Es numeric (no int) para
  -- poder insertar entre dos tarjetas calculando el punto medio, sin
  -- reescribir el orden de toda la columna en cada arrastre.
  add column board_order numeric(20, 6) not null default 0,
  add column tags text[] not null default '{}',
  -- Jerarquía épica → historia → tarea. on delete set null: borrar la
  -- épica no debe llevarse los hijos, solo dejarlos huérfanos en el backlog.
  add column parent_task_id uuid references public.tasks (id) on delete set null,
  add column estimated_hours numeric(6, 2) check (estimated_hours >= 0),
  add column completed_hours numeric(6, 2) check (completed_hours >= 0),
  add column started_at timestamptz,
  add column completed_at timestamptz;

-- El tablero siempre consulta por mes y pinta columna por columna.
create index tasks_month_status_order_idx
  on public.tasks (month_id, status, board_order);

create index tasks_parent_idx on public.tasks (parent_task_id);

-- Sella las fechas de flujo desde el servidor en vez de confiar en lo que
-- mande el cliente al mover una tarjeta: entrar por primera vez a un estado
-- de trabajo fija started_at, llegar a 'completada' fija completed_at, y
-- salir de 'completada' (una tarjeta reabierta) lo limpia. Así el tiempo de
-- ciclo que muestra la UI es consistente aunque se cambie el estado desde
-- el tablero, el backlog o el detalle.
create or replace function public.tg_tasks_track_status_timestamps()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('en_progreso', 'en_revision') and new.started_at is null then
    new.started_at = now();
  end if;

  if new.status = 'completada' then
    if new.completed_at is null then
      new.completed_at = now();
    end if;
  else
    new.completed_at = null;
  end if;

  return new;
end;
$$;

create trigger tasks_track_status_timestamps
  before insert or update of status on public.tasks
  for each row execute function public.tg_tasks_track_status_timestamps();

-- Realtime: el tablero es colaborativo (varias personas moviendo tarjetas a
-- la vez), igual que la grilla y los comentarios — ver *_enable_realtime.sql.
alter publication supabase_realtime add table public.tasks;

-- create_month_from_previous ya copiaba las tareas al mes nuevo; se
-- actualiza para arrastrar también los campos del tablero. La jerarquía
-- (parent_task_id) no se remapea: requeriría una tabla de mapeo extra como
-- _people_map/_project_map, y las tareas copiadas llegan al mes nuevo como
-- work items independientes del backlog. Las marcas de tiempo de flujo
-- (started_at/completed_at) tampoco se copian: en el mes nuevo la tarea
-- vuelve a empezar.
create or replace function public.create_month_from_previous(
  p_source_month_id uuid,
  p_new_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_month_id uuid;
  v_source public.months%rowtype;
begin
  if not public.is_gestor_or_admin() then
    raise exception 'No tiene permisos para crear un mes';
  end if;

  select * into v_source from public.months where id = p_source_month_id;
  if not found then
    raise exception 'El mes de origen no existe';
  end if;

  insert into public.months (name, status, default_hours, working_days, notes, source_month_id, created_by)
  values (p_new_name, 'abierto', v_source.default_hours, v_source.working_days, v_source.notes, p_source_month_id, auth.uid())
  returning id into v_new_month_id;

  create temporary table _people_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  create temporary table _project_map (old_id uuid primary key, new_id uuid not null) on commit drop;

  insert into _people_map (old_id, new_id)
  select id, gen_random_uuid() from public.people where month_id = p_source_month_id;

  insert into public.people (id, month_id, name, job_title, available_hours, status, notes, cloned_from_id, created_by)
  select m.new_id, v_new_month_id, p.name, p.job_title, p.available_hours, p.status, p.notes, p.id, auth.uid()
  from public.people p
  join _people_map m on m.old_id = p.id
  where p.month_id = p_source_month_id;

  insert into _project_map (old_id, new_id)
  select id, gen_random_uuid() from public.projects where month_id = p_source_month_id;

  -- `category` se agregó después de la versión original de esta función y
  -- se quedó fuera de la copia: duplicar un mes convertía los bloques
  -- "institucional" en proyectos normales. Se incluye aquí.
  insert into public.projects (id, month_id, name, color, status, description, category, cloned_from_id, created_by)
  select m.new_id, v_new_month_id, pr.name, pr.color, pr.status, pr.description, pr.category, pr.id, auth.uid()
  from public.projects pr
  join _project_map m on m.old_id = pr.id
  where pr.month_id = p_source_month_id;

  insert into public.project_managers (month_id, project_id, person_id, is_primary)
  select v_new_month_id, prm.new_id, pem.new_id, pm.is_primary
  from public.project_managers pm
  join _project_map prm on prm.old_id = pm.project_id
  join _people_map pem on pem.old_id = pm.person_id
  where pm.month_id = p_source_month_id;

  insert into public.tasks (
    month_id, project_id, title, description, status, assigned_person_id, due_date,
    work_item_type, priority, board_order, tags, estimated_hours, created_by
  )
  select
    v_new_month_id, prm.new_id, t.title, t.description, t.status, pem.new_id, t.due_date,
    t.work_item_type, t.priority, t.board_order, t.tags, t.estimated_hours, auth.uid()
  from public.tasks t
  join _project_map prm on prm.old_id = t.project_id
  left join _people_map pem on pem.old_id = t.assigned_person_id
  where t.month_id = p_source_month_id;

  insert into public.allocations (month_id, person_id, project_id, hours, updated_by)
  select v_new_month_id, pem.new_id, prm.new_id, a.hours, auth.uid()
  from public.allocations a
  join _people_map pem on pem.old_id = a.person_id
  join _project_map prm on prm.old_id = a.project_id
  where a.month_id = p_source_month_id;

  return v_new_month_id;
end;
$$;

revoke all on function public.create_month_from_previous(uuid, text) from public;
grant execute on function public.create_month_from_previous(uuid, text) to authenticated;
