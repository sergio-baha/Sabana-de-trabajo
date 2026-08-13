-- La actividad que el gestor desglosa en la grilla ES el encargo de trabajo:
-- debe aparecerle a la persona en su tablero y en su cronograma, sin que
-- nadie la vuelva a escribir como tarea.
--
-- Modelo: la actividad manda, la tarea es su cara operativa.
--   · Crear una actividad crea la tarea, asignada a la persona de la celda.
--   · Editarla sincroniza título, horas y fecha.
--   · Borrarla borra la tarea SOLO si nadie la trabajó todavía (sigue en
--     'pendiente' y sin comentarios). Si ya se movió, la tarea sobrevive
--     desligada: no se le borra el trabajo a nadie por editar la sábana.
--
-- El estado NO se sincroniza al revés: que el analista mueva la tarjeta no
-- cambia la actividad ni las horas repartidas. Las horas del mes son la
-- planeación; el tablero es la ejecución.

alter table public.activities
  add column task_id uuid references public.tasks (id) on delete set null;

create index activities_task_idx on public.activities (task_id);

-- ---------------------------------------------------------------------------
-- Crear / sincronizar
-- ---------------------------------------------------------------------------
create or replace function public.tg_activity_syncs_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alloc public.allocations%rowtype;
  v_task_id uuid;
  v_next_order numeric(20, 6);
begin
  select * into v_alloc from public.allocations where id = new.allocation_id;
  if not found then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.task_id is not null then
    -- Sincronizar lo que describe el encargo. El estado, la prioridad y el
    -- orden en el tablero son del analista: no se tocan.
    update public.tasks t
    set title = new.description,
        estimated_hours = new.hours,
        start_date = new.activity_date,
        due_date = new.activity_date,
        phase_id = new.phase_id
    where t.id = new.task_id;
    return new;
  end if;

  if new.task_id is not null then
    return new;
  end if;

  -- Al final de la columna "Por hacer", como cualquier tarea nueva.
  select coalesce(max(board_order), 0) + 1 into v_next_order
  from public.tasks
  where month_id = new.month_id and status = 'pendiente';

  insert into public.tasks (
    month_id, project_id, title, description, status, work_item_type,
    estimated_hours, start_date, due_date, phase_id, board_order, created_by
  )
  values (
    new.month_id,
    v_alloc.project_id,
    new.description,
    'Actividad planeada en la distribución de horas del mes.',
    'pendiente',
    'tarea',
    new.hours,
    new.activity_date,
    new.activity_date,
    new.phase_id,
    v_next_order,
    auth.uid()
  )
  returning id into v_task_id;

  -- Asignada a la persona de la celda: es de quien son esas horas.
  insert into public.task_assignees (month_id, task_id, person_id)
  values (new.month_id, v_task_id, v_alloc.person_id)
  on conflict (task_id, person_id) do nothing;

  -- `new.task_id` no se puede fijar desde un AFTER, así que se escribe.
  update public.activities set task_id = v_task_id where id = new.id;

  return new;
end;
$$;

create trigger activity_syncs_task
  after insert or update of description, hours, activity_date, phase_id
  on public.activities
  for each row execute function public.tg_activity_syncs_task();

-- ---------------------------------------------------------------------------
-- Borrar
-- ---------------------------------------------------------------------------
create or replace function public.tg_activity_deletes_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.task_id is null then
    return old;
  end if;

  delete from public.tasks t
  where t.id = old.task_id
    and t.status = 'pendiente'
    and not exists (select 1 from public.task_comments c where c.task_id = t.id);

  return old;
end;
$$;

create trigger activity_deletes_task
  before delete on public.activities
  for each row execute function public.tg_activity_deletes_task();

-- ---------------------------------------------------------------------------
-- Backfill: las actividades que ya existían también son encargos
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_task_id uuid;
begin
  for r in
    select a.*, al.project_id, al.person_id
    from public.activities a
    join public.allocations al on al.id = a.allocation_id
    where a.task_id is null
    order by a.created_at
  loop
    insert into public.tasks (
      month_id, project_id, title, description, status, work_item_type,
      estimated_hours, start_date, due_date, phase_id, board_order, created_by
    )
    values (
      r.month_id, r.project_id, r.description,
      'Actividad planeada en la distribución de horas del mes.',
      'pendiente', 'tarea', r.hours, r.activity_date, r.activity_date, r.phase_id,
      (select coalesce(max(board_order), 0) + 1 from public.tasks
        where month_id = r.month_id and status = 'pendiente'),
      r.created_by
    )
    returning id into v_task_id;

    insert into public.task_assignees (month_id, task_id, person_id)
    values (r.month_id, v_task_id, r.person_id)
    on conflict (task_id, person_id) do nothing;

    update public.activities set task_id = v_task_id where id = r.id;
  end loop;
end;
$$;
