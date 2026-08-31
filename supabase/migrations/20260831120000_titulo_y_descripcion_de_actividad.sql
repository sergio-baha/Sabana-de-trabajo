-- Una actividad del desglose de horas (ActivityBreakdownPanel) solo tenía UN
-- campo de texto libre ("Descripción de la actividad…"), y ese único texto
-- terminaba siendo el TÍTULO de la tarea que genera (ver
-- tg_activity_syncs_task en *_actividad_genera_tarea.sql) — la tarea
-- resultante quedaba con una descripción fija para todas: "Actividad
-- planeada en la distribución de horas del mes." Sin espacio para contarle
-- a quien la recibe qué hay que hacer en detalle.
--
-- Se agrega `notes`: descripción opcional y más larga, aparte del texto
-- corto que ya existía (que pasa a jugar el papel de título). Una actividad
-- sin notas sigue generando la tarea exactamente igual que antes (cae al
-- mismo texto genérico) — nada se rompe para lo que ya existe.

alter table public.activities add column if not exists notes text;

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
        description = coalesce(
          nullif(btrim(new.notes), ''),
          'Actividad planeada en la distribución de horas del mes.'
        ),
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
    coalesce(
      nullif(btrim(new.notes), ''),
      'Actividad planeada en la distribución de horas del mes.'
    ),
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

-- Se recrea el trigger para sumar `notes` a la lista de columnas que
-- disparan la sincronización — editar solo la descripción larga, sin tocar
-- el título/horas/fecha/fase, también debe reflejarse en la tarea.
drop trigger if exists activity_syncs_task on public.activities;
create trigger activity_syncs_task
  after insert or update of description, notes, hours, activity_date, phase_id
  on public.activities
  for each row execute function public.tg_activity_syncs_task();
