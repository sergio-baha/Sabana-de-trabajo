-- Entregar a revisión exige decir cuántas horas costó de verdad.
--
-- La sábana reparte horas PLANEADAS. Sin el dato real no hay con qué comparar
-- y la planeación del mes siguiente se hace a ojo. El momento natural para
-- pedirlo es la entrega: es cuando la persona sabe cuánto le tomó.
--
-- Cada entrega deja su propio registro, no un número que se pisa: si el gestor
-- devuelve el trabajo, el reproceso se reporta aparte y se ve cuánto costó de
-- más. `tasks.completed_hours` queda como el acumulado (planeadas vs reales se
-- leen juntas en el tablero y el backlog).
--
-- Excepción pedida por el equipo: quien creó la tarea no reporta. Es trabajo
-- que se puso a sí mismo, no un encargo que haya que medir contra un plan.

create table public.task_time_reports (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  -- 1 = entrega inicial; 2+ = cada reproceso después de una devolución.
  round smallint not null default 1,
  hours numeric(6, 2) not null check (hours > 0),
  note text,
  reported_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index task_time_reports_task_idx on public.task_time_reports (task_id, created_at);

alter table public.task_time_reports enable row level security;

revoke all on public.task_time_reports from anon;
-- Sin insert para `authenticated`: las filas las crea el RPC de entrega, para
-- que el reporte y el cambio de estado sean el mismo acto y nadie pueda
-- inventar horas sueltas. Mismo criterio que audit_logs y notifications.
grant select on public.task_time_reports to authenticated;

-- Se ve lo que se puede ver: la visibilidad la hereda de `tasks`, cuyo RLS ya
-- resuelve quién ve qué.
create policy "task_time_reports_select" on public.task_time_reports
  for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_time_reports.task_id));

-- ---------------------------------------------------------------------------
-- ¿Esta persona debe reportar horas al entregar esta tarea?
-- ---------------------------------------------------------------------------
create or replace function public.task_requires_time_report(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- Mismo público que el circuito de revisión (ver task_requires_review):
    -- el Analista de Tecnología queda fuera, cierra su trabajo él mismo.
    public.is_analista_role()
    and not public.is_analista_tecnologia()
    -- ...y solo si la tarea es un encargo, no algo que se puso él mismo.
    and not exists (
      select 1 from public.tasks t
      where t.id = p_task_id and t.created_by = auth.uid()
    );
$$;

revoke all on function public.task_requires_time_report(uuid) from public;
grant execute on function public.task_requires_time_report(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Entregar = reportar + cambiar de estado, en un solo acto
-- ---------------------------------------------------------------------------
create or replace function public.submit_task_for_review(
  p_task_id uuid,
  p_hours numeric default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks%rowtype;
begin
  select * into v_task from public.tasks where id = p_task_id;
  if not found then
    raise exception 'La tarea no existe';
  end if;

  -- Corre como definer (se salta RLS), así que la pertenencia se comprueba
  -- acá: entrega quien hace el trabajo o quien lo gestiona.
  if not (
    public.is_gestor_or_admin()
    or public.is_task_assignee(p_task_id)
    or v_task.created_by = auth.uid()
  ) then
    raise exception 'No puedes entregar una tarea que no es tuya';
  end if;

  if public.task_requires_time_report(p_task_id)
     and (p_hours is null or p_hours <= 0) then
    raise exception 'Indica las horas reales que te tomó la tarea';
  end if;

  if p_hours is not null and p_hours > 0 then
    insert into public.task_time_reports (task_id, round, hours, note, reported_by)
    values (p_task_id, coalesce(v_task.returned_count, 0) + 1, p_hours, p_note, auth.uid());
  end if;

  -- Bandera de sesión que el trigger del circuito lee para saber que la
  -- entrega vino por acá y ya trae su reporte. `true` = solo esta
  -- transacción.
  perform set_config('app.time_reported', 'on', true);

  update public.tasks set status = 'en_revision' where id = p_task_id;
end;
$$;

revoke all on function public.submit_task_for_review(uuid, numeric, text) from public;
grant execute on function public.submit_task_for_review(uuid, numeric, text) to authenticated;

-- `completed_hours` pasa a ser el acumulado real cuando hay reportes. Si nadie
-- reporta (tareas de gestor, que cierran directo) sigue siendo el campo manual
-- del formulario, como hasta ahora.
create or replace function public.tg_time_report_rolls_up()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tasks t
  set completed_hours = (
    select coalesce(sum(r.hours), 0) from public.task_time_reports r where r.task_id = t.id
  )
  where t.id = coalesce(new.task_id, old.task_id);
  return null;
end;
$$;

create trigger time_report_rolls_up
  after insert or update or delete on public.task_time_reports
  for each row execute function public.tg_time_report_rolls_up();

-- ---------------------------------------------------------------------------
-- El circuito de revisión ahora exige el reporte
-- ---------------------------------------------------------------------------
-- Se reescribe completo (create or replace no admite parches): es el mismo
-- cuerpo de *_task_review_flow.sql más la comprobación de la bandera.
create or replace function public.tg_task_review_flow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status or auth.uid() is null then
    return new;
  end if;

  if new.status = 'completada' and public.task_requires_review(new.project_id) then
    raise exception 'Esta tarea la cierra el gestor del proyecto. Envíala a revisión.'
      using errcode = 'check_violation';
  end if;

  if new.status = 'en_revision' then
    -- Entregar sin pasar por submit_task_for_review dejaría la entrega sin
    -- horas reales. La bandera la pone ese RPC dentro de su transacción.
    if public.task_requires_time_report(new.id)
       and coalesce(current_setting('app.time_reported', true), '') <> 'on' then
      raise exception 'Al entregar hay que reportar las horas reales de la tarea'
        using errcode = 'check_violation';
    end if;

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

alter publication supabase_realtime add table public.task_time_reports;
