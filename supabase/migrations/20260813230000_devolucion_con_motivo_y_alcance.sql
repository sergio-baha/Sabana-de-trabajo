-- Dos reglas del circuito de trabajo:
--
-- 1. Devolver una entrega exige decir por qué. Un "te la devuelvo" sin motivo
--    manda la conversación fuera de la plataforma y deja al analista
--    adivinando; además el reproceso se le va a medir en horas, así que tiene
--    derecho a saber qué hay que corregir.
--
-- 2. Cada quien ve el trabajo que le toca:
--      · Analista → solo lo asignado a él y lo que él creó.
--      · Gestor   → solo lo de los proyectos que gerencia (más lo suyo).
--      · Admin    → todo.
--    Antes un analista veía TODAS las tareas de los proyectos donde figuraba
--    como miembro, y un gestor las de todo el mes. Ahora ser miembro de un
--    proyecto ya no abre el trabajo ajeno: la pertenencia sirve para asignar,
--    no para mirar.

-- ---------------------------------------------------------------------------
-- 1. ¿Gerencio este proyecto?
-- ---------------------------------------------------------------------------
create or replace function public.is_project_manager(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_managers pm
    join public.people pe on pe.id = pm.person_id
    where pm.project_id = p_project_id
      and pe.profile_id = auth.uid()
  );
$$;

revoke all on function public.is_project_manager(uuid) from public;
grant execute on function public.is_project_manager(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Quién ve qué tarea
-- ---------------------------------------------------------------------------
drop policy "tasks_select_scoped" on public.tasks;

create policy "tasks_select_scoped" on public.tasks
  for select to authenticated
  using (
    public.is_admin()
    or (
      -- Gestor: lo de sus proyectos, más lo propio.
      not public.is_analista_role()
      and (
        public.is_project_manager(project_id)
        or created_by = auth.uid()
        or public.is_task_assignee(id)
      )
    )
    or (
      -- Analista: lo suyo y nada más, y solo si el mes ya se liberó.
      public.is_analista_role()
      and public.is_month_released(month_id)
      and (public.is_task_assignee(id) or created_by = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Devolver = comentar el motivo + cambiar de estado, en un solo acto
-- ---------------------------------------------------------------------------
create or replace function public.return_task_for_rework(
  p_task_id uuid,
  p_status public.task_status,
  p_comment text
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

  if v_task.status <> 'en_revision' then
    raise exception 'Solo se devuelve una tarea que esté en revisión';
  end if;

  if p_status in ('en_revision', 'completada') then
    raise exception 'Devolver es sacarla de revisión sin cerrarla';
  end if;

  -- Corre como definer (se salta RLS): quién puede devolver se comprueba acá.
  if not (public.is_admin() or public.is_project_manager(v_task.project_id)) then
    raise exception 'Solo el gestor del proyecto puede devolver una entrega';
  end if;

  if coalesce(btrim(p_comment), '') = '' then
    raise exception 'Explica qué hay que corregir antes de devolver la tarea';
  end if;

  insert into public.task_comments (task_id, author_id, body)
  values (p_task_id, auth.uid(), btrim(p_comment));

  -- Bandera de sesión que lee el trigger del circuito: la devolución vino por
  -- acá y ya trae su motivo. `true` = solo esta transacción.
  perform set_config('app.rework_commented', 'on', true);

  update public.tasks set status = p_status where id = p_task_id;
end;
$$;

revoke all on function public.return_task_for_rework(uuid, public.task_status, text) from public;
grant execute on function public.return_task_for_rework(uuid, public.task_status, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. El circuito exige el motivo
-- ---------------------------------------------------------------------------
-- Se reescribe completo (create or replace no admite parches): mismo cuerpo de
-- *_horas_reales_al_entregar.sql más la comprobación del motivo al devolver.
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
      -- Que el propio autor retire su entrega no es una devolución: no hay a
      -- quién explicarle nada. Devolvérsela a otro, sí.
      if old.submitted_by is distinct from auth.uid()
         and coalesce(current_setting('app.rework_commented', true), '') <> 'on' then
        raise exception 'Al devolver una entrega hay que explicar qué corregir'
          using errcode = 'check_violation';
      end if;

      new.returned_count := coalesce(old.returned_count, 0) + 1;
    end if;
  end if;

  return new;
end;
$$;
