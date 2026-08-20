-- Arregla "versiones del mes" (snapshots): está rota desde el 12 de agosto y
-- además esconde una trampa que nunca llegó a dispararse.
--
-- QUÉ PASÓ, en orden:
--
-- 1. `restore_month_snapshot` (30 de julio) restauraba haciendo
--    `delete from public.projects where month_id = ...` seguido de un insert
--    con los mismos ids. Pero `tasks.project_id` es ON DELETE CASCADE, así
--    que ese delete se habría llevado TODAS las tareas del mes — no solo las
--    posteriores al checkpoint, como decía su propio comentario. Al
--    reinsertar los proyectos con el mismo id la sábana quedaba intacta y el
--    tablero vacío: nadie lo habría notado en el momento.
--
--    Que conste para quien investigue las 104 tarjetas que faltan del
--    historial: NO fueron esto. El grueso (68) se perdió al borrar dos meses,
--    cuando `projects.month_id` todavía era ON DELETE CASCADE y el borrado
--    bajaba en cadena mes → proyectos → tareas. Esta trampa quedó armada
--    durante dos semanas sin que nadie la pisara.
--
-- 2. *_proyecto_durable.sql eliminó `projects.month_id`,
--    `projects.cloned_from_id` y `project_managers.month_id`. Desde entonces
--    las dos funciones leen columnas que no existen y fallan al ejecutarse.
--    *_meses_solo_admin.sql reescribió `create_month_snapshot` para cambiarle
--    la guardia y volvió a copiar el cuerpo viejo, con el mismo tropiezo que
--    documenta *_fix_duplicar_mes.sql: plpgsql no valida el cuerpo contra el
--    esquema hasta que corre.
--
-- QUÉ ES UNA VERSIÓN DEL MES AHORA:
--
-- Con proyectos durables, el mes ya no contiene el catálogo de proyectos —
-- contiene el ROSTER y el REPARTO DE HORAS. Eso es lo único que el snapshot
-- guarda y lo único que restaurar toca. `projects` sale del snapshot por
-- completo, y con eso el cascade que borraba las tarjetas deja de existir:
-- no es que se evite, es que ya no hay ningún camino desde restaurar hasta
-- `tasks`.
--
-- DOS REGLAS QUE NO SE NEGOCIAN AL RESTAURAR:
--
-- · No se borra a nadie del roster. `task_assignees.person_id` es ON DELETE
--   CASCADE: borrar una fila de `people` se lleva en silencio todas las
--   tarjetas que esa persona tuviera asignadas, y `task_assignees` no es
--   reconstruible desde el historial. Una persona que sobra queda con 0
--   horas, que es visible y reversible; una persona borrada no.
--
-- · No se borran celdas de horas. `comments.allocation_id` es ON DELETE
--   CASCADE, así que borrar una celda se lleva su discusión. Las celdas que
--   sobran se ponen en 0, que es exactamente como la plataforma ancla un
--   comentario en una celda sin horas (ver
--   *_allocations_allow_comment_anchor.sql).
--
-- Restaurar deja entonces el reparto de horas EXACTO del checkpoint, y lo
-- que no estaba en él queda a la vista en cero en vez de desaparecer.

-- ---------------------------------------------------------------------------
-- 1. Crear una versión
-- ---------------------------------------------------------------------------
create or replace function public.create_month_snapshot(
  p_month_id uuid,
  p_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot_id uuid;
  v_snapshot jsonb;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede crear una versión de un mes';
  end if;

  if not exists (select 1 from public.months where id = p_month_id) then
    raise exception 'El mes indicado no existe';
  end if;

  -- Sin `projects` ni `project_managers`: son durables, no del mes. Se suma
  -- `person_rates`, que sí es por persona-mes y antes quedaba fuera.
  select jsonb_build_object(
    'version', 2,
    'people', (
      select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
      from public.people p where p.month_id = p_month_id
    ),
    'person_rates', (
      select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
      from public.person_rates r where r.month_id = p_month_id
    ),
    'allocations', (
      select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
      from public.allocations a where a.month_id = p_month_id
    )
  ) into v_snapshot;

  insert into public.month_snapshots (month_id, label, snapshot, created_by)
  values (p_month_id, p_label, v_snapshot, auth.uid())
  returning id into v_snapshot_id;

  return v_snapshot_id;
end;
$$;

revoke all on function public.create_month_snapshot(uuid, text) from public;
grant execute on function public.create_month_snapshot(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Restaurar una versión
-- ---------------------------------------------------------------------------
create or replace function public.restore_month_snapshot(p_snapshot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_id uuid;
  v_snapshot jsonb;
  v_omitidas integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede restaurar una versión de mes';
  end if;

  select month_id, snapshot into v_month_id, v_snapshot
  from public.month_snapshots where id = p_snapshot_id;

  if not found then
    raise exception 'La versión indicada no existe';
  end if;

  -- ── Roster ───────────────────────────────────────────────────────────────
  -- Primero las que siguen ahí: se corrigen en sitio, conservando su id y con
  -- él las tarjetas y las celdas que cuelgan de ella.
  update public.people p
  set name            = e ->> 'name',
      job_title       = e ->> 'job_title',
      available_hours = (e ->> 'available_hours')::numeric,
      status          = (e ->> 'status')::public.person_status,
      notes           = e ->> 'notes',
      updated_at      = now()
  from jsonb_array_elements(v_snapshot -> 'people') e
  where p.id = (e ->> 'id')::uuid
    and p.month_id = v_month_id;

  -- Después las que faltan. Se omite la que chocaría contra
  -- `people_month_profile_idx` — esa cuenta ya tiene fila en el mes bajo otro
  -- id (la creó el alta automática desde las cuentas), y reponer la vieja
  -- reintroduciría el duplicado que se fusionó a mano en agosto.
  with candidatas as (
    select e
    from jsonb_array_elements(v_snapshot -> 'people') e
    where not exists (
            select 1 from public.people p where p.id = (e ->> 'id')::uuid
          )
      and not exists (
            select 1 from public.people p
            where p.month_id = v_month_id
              and p.profile_id is not null
              and p.profile_id = (e ->> 'profile_id')::uuid
          )
  )
  insert into public.people
    (id, month_id, name, job_title, available_hours, status, notes,
     profile_id, created_by, created_at, updated_at)
  select
    (e ->> 'id')::uuid, v_month_id, e ->> 'name', e ->> 'job_title',
    (e ->> 'available_hours')::numeric,
    (e ->> 'status')::public.person_status,
    e ->> 'notes',
    (e ->> 'profile_id')::uuid,
    (e ->> 'created_by')::uuid,
    (e ->> 'created_at')::timestamptz,
    now()
  from candidatas;

  -- ── Tarifas ──────────────────────────────────────────────────────────────
  insert into public.person_rates (person_id, month_id, hourly_rate, updated_by)
  select (e ->> 'person_id')::uuid, v_month_id,
         (e ->> 'hourly_rate')::numeric, auth.uid()
  from jsonb_array_elements(coalesce(v_snapshot -> 'person_rates', '[]'::jsonb)) e
  where exists (
    select 1 from public.people p where p.id = (e ->> 'person_id')::uuid
  )
  on conflict (person_id) do update
    set hourly_rate = excluded.hourly_rate,
        updated_by  = excluded.updated_by,
        updated_at  = now();

  -- ── Reparto de horas ─────────────────────────────────────────────────────
  -- Todo lo que no está en la versión se pone en cero ANTES de aplicarla, y
  -- no se borra: la celda sobrevive como ancla de sus comentarios.
  update public.allocations a
  set hours = 0, updated_by = auth.uid(), updated_at = now()
  where a.month_id = v_month_id
    and a.hours <> 0
    and not exists (
      select 1
      from jsonb_array_elements(v_snapshot -> 'allocations') e
      where (e ->> 'person_id')::uuid = a.person_id
        and (e ->> 'project_id')::uuid = a.project_id
    );

  -- Y ahora la versión, tal cual quedó guardada. Se saltan las filas cuyo
  -- proyecto o persona ya no existen: el proyecto pudo archivarse o borrarse
  -- después del checkpoint, y resucitarlo no es lo que pidió quien restaura.
  with aplicables as (
    select e
    from jsonb_array_elements(v_snapshot -> 'allocations') e
    where exists (select 1 from public.people   p where p.id = (e ->> 'person_id')::uuid)
      and exists (select 1 from public.projects r where r.id = (e ->> 'project_id')::uuid)
  )
  insert into public.allocations (month_id, person_id, project_id, hours, updated_by)
  select v_month_id, (e ->> 'person_id')::uuid, (e ->> 'project_id')::uuid,
         (e ->> 'hours')::numeric, auth.uid()
  from aplicables
  on conflict (month_id, person_id, project_id) do update
    set hours = excluded.hours,
        updated_by = excluded.updated_by,
        updated_at = now();

  select count(*) into v_omitidas
  from jsonb_array_elements(v_snapshot -> 'allocations') e
  where not exists (select 1 from public.people   p where p.id = (e ->> 'person_id')::uuid)
     or not exists (select 1 from public.projects r where r.id = (e ->> 'project_id')::uuid);

  if v_omitidas > 0 then
    raise notice
      'Restaurado. % celda(s) de la versión se omitieron: su persona o su proyecto ya no existe.',
      v_omitidas;
  end if;
end;
$$;

revoke all on function public.restore_month_snapshot(uuid) from public;
grant execute on function public.restore_month_snapshot(uuid) to authenticated;
