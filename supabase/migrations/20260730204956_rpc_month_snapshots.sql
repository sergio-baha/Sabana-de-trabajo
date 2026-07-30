-- create_month_snapshot: checkpoint manual/automático de un mes (Gestor+Admin).
create or replace function public.create_month_snapshot(p_month_id uuid, p_label text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot_id uuid;
  v_snapshot jsonb;
begin
  if not public.is_gestor_or_admin() then
    raise exception 'No tiene permisos para crear una versión de este mes';
  end if;

  select jsonb_build_object(
    'people', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from public.people p where p.month_id = p_month_id),
    'projects', (select coalesce(jsonb_agg(to_jsonb(pr)), '[]'::jsonb) from public.projects pr where pr.month_id = p_month_id),
    'project_managers', (select coalesce(jsonb_agg(to_jsonb(pm)), '[]'::jsonb) from public.project_managers pm where pm.month_id = p_month_id),
    'allocations', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.allocations a where a.month_id = p_month_id)
  ) into v_snapshot;

  insert into public.month_snapshots (month_id, label, snapshot, created_by)
  values (p_month_id, p_label, v_snapshot, auth.uid())
  returning id into v_snapshot_id;

  return v_snapshot_id;
end;
$$;

revoke all on function public.create_month_snapshot(uuid, text) from public;
grant execute on function public.create_month_snapshot(uuid, text) to authenticated;

-- restore_month_snapshot: revierte people/projects/project_managers/allocations
-- de un mes al estado exacto guardado (mismos IDs, para que comments que
-- apunten a esas allocations se reconecten). Solo Admin. Nota: tasks NO forma
-- parte del snapshot (ver 0016/plan), así que restaurar borra las tareas
-- creadas después del checkpoint junto con projects/people que ya no existan.
create or replace function public.restore_month_snapshot(p_snapshot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_id uuid;
  v_snapshot jsonb;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede restaurar una versión de mes';
  end if;

  select month_id, snapshot into v_month_id, v_snapshot
  from public.month_snapshots where id = p_snapshot_id;

  if not found then
    raise exception 'La versión indicada no existe';
  end if;

  delete from public.allocations where month_id = v_month_id;
  delete from public.project_managers where month_id = v_month_id;
  delete from public.projects where month_id = v_month_id;
  delete from public.people where month_id = v_month_id;

  insert into public.people
    (id, month_id, name, job_title, available_hours, status, notes, cloned_from_id, created_by, created_at, updated_at)
  select
    (elem ->> 'id')::uuid, v_month_id, elem ->> 'name', elem ->> 'job_title',
    (elem ->> 'available_hours')::numeric, (elem ->> 'status')::public.person_status, elem ->> 'notes',
    (elem ->> 'cloned_from_id')::uuid, (elem ->> 'created_by')::uuid,
    (elem ->> 'created_at')::timestamptz, now()
  from jsonb_array_elements(v_snapshot -> 'people') elem;

  insert into public.projects
    (id, month_id, name, color, status, description, cloned_from_id, created_by, created_at, updated_at)
  select
    (elem ->> 'id')::uuid, v_month_id, elem ->> 'name', elem ->> 'color',
    (elem ->> 'status')::public.project_status, elem ->> 'description',
    (elem ->> 'cloned_from_id')::uuid, (elem ->> 'created_by')::uuid,
    (elem ->> 'created_at')::timestamptz, now()
  from jsonb_array_elements(v_snapshot -> 'projects') elem;

  insert into public.project_managers (id, month_id, project_id, person_id, is_primary, created_at)
  select
    (elem ->> 'id')::uuid, v_month_id, (elem ->> 'project_id')::uuid, (elem ->> 'person_id')::uuid,
    (elem ->> 'is_primary')::boolean, (elem ->> 'created_at')::timestamptz
  from jsonb_array_elements(v_snapshot -> 'project_managers') elem;

  insert into public.allocations (id, month_id, person_id, project_id, hours, updated_by, created_at, updated_at)
  select
    (elem ->> 'id')::uuid, v_month_id, (elem ->> 'person_id')::uuid, (elem ->> 'project_id')::uuid,
    (elem ->> 'hours')::numeric, auth.uid(), (elem ->> 'created_at')::timestamptz, now()
  from jsonb_array_elements(v_snapshot -> 'allocations') elem;
end;
$$;

revoke all on function public.restore_month_snapshot(uuid) from public;
grant execute on function public.restore_month_snapshot(uuid) to authenticated;
