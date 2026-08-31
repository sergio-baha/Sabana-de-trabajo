-- Dos excepciones más al circuito de revisión, pedidas por el usuario:
--
--   1. Los proyectos de categoría 'emergente' (urgencias sin planear, ver
--      *_categoria_emergente.sql) no pasan por revisión de gestor — se
--      cierran directo, sin importar quién los creó.
--   2. Una tarea que el propio Analista creó PARA SÍ MISMO tampoco pasa por
--      revisión — igual que ya pasaba si el PROYECTO era suyo, ahora
--      también si la TAREA puntual es suya dentro de un proyecto ajeno
--      (p. ej. una tarea que él mismo se agregó en un proyecto del equipo).
--
-- task_requires_review() solo recibía el project_id, así que no podía ver
-- quién creó la TAREA ni la categoría del proyecto — se le cambia el
-- parámetro a task_id, y se actualizan los tres llamadores que le pasaban
-- project_id. El tipo (uuid) no cambia, pero Postgres igual exige DROP
-- antes de CREATE cuando cambia el NOMBRE del parámetro (create or replace
-- solo tolera cambios de tipo/default, no de nombre).
drop function if exists public.task_requires_review(uuid);

create function public.task_requires_review(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_analista_role()
    and not public.is_analista_tecnologia()
    and not exists (
      select 1
      from public.tasks t
      join public.projects pr on pr.id = t.project_id
      where t.id = p_task_id
        and (
          t.created_by = auth.uid()
          or pr.created_by = auth.uid()
          or pr.category = 'emergente'
        )
    );
$$;

-- El comentario de la firma vieja decía "p_project_id" en su lugar; se dejó
-- explícito acá porque revoke/grant solo referencian el tipo, no el nombre.
revoke all on function public.task_requires_review(uuid) from public;
grant execute on function public.task_requires_review(uuid) to authenticated;

create or replace function public.submit_task_for_review(
  p_task_id uuid,
  p_reviewer_person_id uuid default null,
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
  v_from_person_id uuid;
begin
  select * into v_task from public.tasks where id = p_task_id;
  if not found then
    raise exception 'La tarea no existe';
  end if;

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

  if public.task_requires_review(p_task_id) and p_reviewer_person_id is null then
    raise exception 'Elige quién debe revisar esta entrega';
  end if;

  if p_reviewer_person_id is not null then
    perform public.validate_task_reviewer(v_task.project_id, p_reviewer_person_id, null);
  end if;

  if p_hours is not null and p_hours > 0 then
    insert into public.task_time_reports (task_id, round, hours, note, reported_by)
    values (p_task_id, coalesce(v_task.returned_count, 0) + 1, p_hours, p_note, auth.uid());
  end if;

  select id into v_from_person_id from public.people
  where profile_id = auth.uid() and month_id = v_task.month_id;

  if v_from_person_id is null then
    select ta.person_id into v_from_person_id
    from public.task_assignees ta
    where ta.task_id = p_task_id
    limit 1;
  end if;

  insert into public.task_review_hops (task_id, action, from_person_id, to_person_id, created_by)
  values (p_task_id, 'enviada', v_from_person_id, p_reviewer_person_id, auth.uid());

  perform set_config('app.time_reported', 'on', true);

  update public.tasks
  set status = 'en_revision', current_reviewer_person_id = p_reviewer_person_id
  where id = p_task_id;
end;
$$;

revoke all on function public.submit_task_for_review(uuid, uuid, numeric, text) from public;
grant execute on function public.submit_task_for_review(uuid, uuid, numeric, text) to authenticated;

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

  if new.status = 'completada' and old.status = 'en_revision' and old.current_reviewer_person_id is not null then
    if not (
      public.is_admin()
      or public.is_project_manager(new.project_id)
      or public.is_own_person(old.current_reviewer_person_id)
    ) then
      raise exception 'Esta tarea la cierra quien tiene la revisión.'
        using errcode = 'check_violation';
    end if;
  elsif new.status = 'completada' and public.task_requires_review(new.id) then
    raise exception 'Esta tarea la cierra el gestor del proyecto. Envíala a revisión.'
      using errcode = 'check_violation';
  end if;

  if new.status = 'en_revision' then
    if public.task_requires_time_report(new.id)
       and coalesce(current_setting('app.time_reported', true), '') <> 'on' then
      raise exception 'Al entregar hay que reportar las horas reales de la tarea'
        using errcode = 'check_violation';
    end if;

    if public.task_requires_review(new.id) and new.current_reviewer_person_id is null then
      raise exception 'Elige quién debe revisar esta entrega'
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

    if new.status = 'completada' then
      insert into public.task_review_hops (task_id, action, from_person_id, created_by)
      values (new.id, 'completada', old.current_reviewer_person_id, auth.uid());
    else
      if old.submitted_by is distinct from auth.uid()
         and coalesce(current_setting('app.rework_commented', true), '') <> 'on' then
        raise exception 'Al devolver una entrega hay que explicar qué corregir'
          using errcode = 'check_violation';
      end if;

      new.returned_count := coalesce(old.returned_count, 0) + 1;

      insert into public.task_review_hops (task_id, action, from_person_id, created_by)
      values (new.id, 'devuelta', old.current_reviewer_person_id, auth.uid());
    end if;

    new.current_reviewer_person_id := null;
  end if;

  return new;
end;
$$;
