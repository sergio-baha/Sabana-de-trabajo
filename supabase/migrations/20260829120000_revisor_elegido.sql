-- Circuito de revisión con revisor elegido (Fase 2).
--
-- Hasta ahora "entregar a revisión" avisaba a TODOS los gestores del
-- proyecto y cualquiera de ellos podía cerrar o devolver. Desde ahora quien
-- entrega ELIGE a una persona puntual del equipo del proyecto (gestores
-- primero, luego el resto) para que revise. Reglas acordadas con el usuario:
--
--   1. Mientras la tarea espera revisión, a quien la entregó (o a quien se
--      la haya reenviado en un salto anterior de la cadena) le queda quieta
--      en "En revisión" — no puede tocarla. Al revisor elegido le aparece
--      en SU "Por hacer": revisar es su pendiente (esto ya lo pintaba el
--      tablero para "cualquier gestor"; ahora es para la persona puntual).
--   2. El revisor actual tiene tres salidas: completarla (cierra, aunque el
--      revisor sea otro Analista — se relaja la regla "solo gestor cierra"),
--      escalarla a alguien más (repite el mismo circuito, la cadena sigue
--      creciendo) o devolverla con motivo.
--   3. Devolver SIEMPRE regresa al remitente ORIGINAL (quien la entregó la
--      primera vez), sin importar cuántos saltos hubo en el medio — no al
--      inmediatamente anterior. No hace falta lógica especial para esto: el
--      remitente original nunca deja de ser el dueño/asignado de la tarea,
--      así que en cuanto sale de 'en_revision' vuelve a aparecerle en su
--      "Por hacer" normal.
--   4. El Analista de Tecnología sigue FUERA de este circuito (cierra su
--      propio trabajo, como hasta ahora).
--   5. Cada salto (entregada / escalada / completada / devuelta) queda en
--      un historial con fecha, para control.

-- Este archivo es idempotente a propósito: se puede volver a correr entero
-- sin importar hasta dónde haya llegado un intento anterior (p. ej. si un
-- borrador previo alcanzó a crear la columna antes de que se corrigieran
-- los huecos de seguridad que traía). Cada paso usa IF EXISTS/IF NOT
-- EXISTS, o create-or-replace, para converger al mismo estado final sin
-- importar el punto de partida.

-- ---------------------------------------------------------------------------
-- 1. Quién debe actuar ahora mismo
-- ---------------------------------------------------------------------------
alter table public.tasks
  add column if not exists current_reviewer_person_id uuid references public.people (id) on delete set null;

create index if not exists tasks_current_reviewer_idx on public.tasks (current_reviewer_person_id);

create or replace function public.is_current_reviewer(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tasks t
    join public.people pe on pe.id = t.current_reviewer_person_id
    where t.id = p_task_id and pe.profile_id = auth.uid()
  );
$$;

revoke all on function public.is_current_reviewer(uuid) from public;
grant execute on function public.is_current_reviewer(uuid) to authenticated;

-- Nadie se revisa a sí mismo, y el revisor tiene que ser alguien real del
-- equipo del proyecto — sin esto, la protección "no te asignes a ti mismo"
-- solo vivía en el <Select> del frontend, y un llamado directo al RPC (o un
-- "reasignar" hacia el remitente original) la saltaba entera.
create or replace function public.validate_task_reviewer(
  p_project_id uuid,
  p_reviewer_person_id uuid,
  p_original_submitter uuid
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_reviewer_profile uuid;
  v_on_team boolean;
begin
  select profile_id into v_reviewer_profile
  from public.people
  where id = p_reviewer_person_id;

  if v_reviewer_profile is null then
    raise exception 'Esa persona no tiene cuenta vinculada, no puede revisar'
      using errcode = 'check_violation';
  end if;

  if v_reviewer_profile = auth.uid() then
    raise exception 'No puedes asignarte la revisión a ti mismo'
      using errcode = 'check_violation';
  end if;

  if p_original_submitter is not null and v_reviewer_profile = p_original_submitter then
    raise exception 'No puedes reasignarla a quien la entregó — usa "Devolver"'
      using errcode = 'check_violation';
  end if;

  select
    exists (
      select 1 from public.project_managers pm
      where pm.project_id = p_project_id and pm.person_id = p_reviewer_person_id
    )
    or exists (
      select 1 from public.project_members pmem
      where pmem.project_id = p_project_id and pmem.person_id = p_reviewer_person_id
    )
  into v_on_team;

  if not v_on_team then
    raise exception 'Elige a alguien del equipo de este proyecto'
      using errcode = 'check_violation';
  end if;
end;
$$;

revoke all on function public.validate_task_reviewer(uuid, uuid, uuid) from public;
grant execute on function public.validate_task_reviewer(uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Historial de saltos — las fechas de control que pidió el usuario
-- ---------------------------------------------------------------------------
create table if not exists public.task_review_hops (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  action text not null check (action in ('enviada', 'escalada', 'completada', 'devuelta')),
  from_person_id uuid references public.people (id) on delete set null,
  to_person_id uuid references public.people (id) on delete set null,
  comment text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists task_review_hops_task_idx on public.task_review_hops (task_id, created_at);

alter table public.task_review_hops enable row level security;
revoke all on public.task_review_hops from anon;
-- Sin insert para `authenticated`: los crea el trigger/los RPCs (definer),
-- igual que task_time_reports — nadie escribe el historial a mano.
grant select on public.task_review_hops to authenticated;

drop policy if exists "task_review_hops_select" on public.task_review_hops;
create policy "task_review_hops_select" on public.task_review_hops
  for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_review_hops.task_id));

-- ---------------------------------------------------------------------------
-- 3. Entregar ahora exige elegir revisor (cuando el circuito aplica)
-- ---------------------------------------------------------------------------
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

  if public.task_requires_review(v_task.project_id) and p_reviewer_person_id is null then
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

  -- Quien entrega no siempre tiene fila propia en el roster del mes (p. ej.
  -- un gestor entregando en nombre de alguien): sin esto, "de quién" queda
  -- en blanco en el historial. Se cae al primer asignado de la tarea.
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

-- ---------------------------------------------------------------------------
-- 4. Escalar: cambia de revisor sin salir de 'en_revision' — no es un
--    cambio de estado, así que el trigger del circuito no interviene; el
--    permiso se comprueba acá mismo.
-- ---------------------------------------------------------------------------
create or replace function public.escalate_task_review(
  p_task_id uuid,
  p_reviewer_person_id uuid,
  p_comment text default null
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
    raise exception 'Solo se reasigna una tarea que esté en revisión';
  end if;

  if not (
    public.is_admin()
    or public.is_project_manager(v_task.project_id)
    or public.is_current_reviewer(p_task_id)
  ) then
    raise exception 'Solo quien tiene la revisión puede reasignarla';
  end if;

  if p_reviewer_person_id is null then
    raise exception 'Elige a quién le reasignas la revisión';
  end if;

  -- Nadie se revisa a sí mismo, ni "escalar" se usa para devolvérsela por la
  -- puerta de atrás a quien la entregó originalmente — eso es lo que existe
  -- "Devolver" para hacer, con motivo obligatorio.
  perform public.validate_task_reviewer(v_task.project_id, p_reviewer_person_id, v_task.submitted_by);

  insert into public.task_review_hops (task_id, action, from_person_id, to_person_id, comment, created_by)
  values (p_task_id, 'escalada', v_task.current_reviewer_person_id, p_reviewer_person_id, p_comment, auth.uid());

  update public.tasks
  set current_reviewer_person_id = p_reviewer_person_id
  where id = p_task_id;
end;
$$;

revoke all on function public.escalate_task_review(uuid, uuid, text) from public;
grant execute on function public.escalate_task_review(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Devolver: ahora también puede el revisor actual, no solo el gestor.
--    Sigue exigiendo motivo y sigue mandando siempre al remitente original
--    (nada que hacer acá: es quien conserva la asignación desde el inicio).
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

  if not (
    public.is_admin()
    or public.is_project_manager(v_task.project_id)
    or public.is_current_reviewer(p_task_id)
  ) then
    raise exception 'Solo quien tiene la revisión puede devolver esta entrega';
  end if;

  if coalesce(btrim(p_comment), '') = '' then
    raise exception 'Explica qué hay que corregir antes de devolver la tarea';
  end if;

  insert into public.task_comments (task_id, author_id, body)
  values (p_task_id, auth.uid(), btrim(p_comment));

  perform set_config('app.rework_commented', 'on', true);

  update public.tasks set status = p_status where id = p_task_id;
end;
$$;

revoke all on function public.return_task_for_rework(uuid, public.task_status, text) from public;
grant execute on function public.return_task_for_rework(uuid, public.task_status, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. El circuito: quien tiene la revisión puede cerrarla directo (se relaja
--    "solo el gestor cierra" para el revisor elegido); registra el salto de
--    cierre/devolución en el historial y limpia el revisor actual al salir
--    de 'en_revision'.
-- ---------------------------------------------------------------------------
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

  -- OJO: task_requires_review() responde "¿el que está actuando necesita
  -- revisión?" (mira SU rol y si SU proyecto es propio) — no "¿esta entrega
  -- puntual tiene un revisor asignado?". Usarla acá para decidir quién
  -- puede cerrar dejaba pasar a cualquier gestor/admin (task_requires_review
  -- siempre da falso para ellos, sin importar el proyecto) y hasta al
  -- Analista que creó el proyecto (cae en la excepción de "no te revisas a
  -- ti mismo" aunque la tarea sea de otra persona). La pregunta correcta es
  -- sobre el ESTADO DE LA TAREA: si tiene un revisor asignado, solo ese
  -- revisor (o el gestor del proyecto, o admin) puede cerrarla — sin
  -- importar el rol de quien lo intenta.
  if new.status = 'completada' and old.status = 'en_revision' and old.current_reviewer_person_id is not null then
    if not (
      public.is_admin()
      or public.is_project_manager(new.project_id)
      or public.is_own_person(old.current_reviewer_person_id)
    ) then
      raise exception 'Esta tarea la cierra quien tiene la revisión.'
        using errcode = 'check_violation';
    end if;
  elsif new.status = 'completada' and public.task_requires_review(new.project_id) then
    -- Respaldo del comportamiento original: no debería alcanzarse casi
    -- nunca (el bloque de abajo ya exige revisor al entrar a 'en_revision'
    -- cuando el circuito aplica), pero si por lo que sea la tarea nunca
    -- pasó por el revisor elegido, un Analista sigue sin poder cerrarla
    -- directo.
    raise exception 'Esta tarea la cierra el gestor del proyecto. Envíala a revisión.'
      using errcode = 'check_violation';
  end if;

  if new.status = 'en_revision' then
    if public.task_requires_time_report(new.id)
       and coalesce(current_setting('app.time_reported', true), '') <> 'on' then
      raise exception 'Al entregar hay que reportar las horas reales de la tarea'
        using errcode = 'check_violation';
    end if;

    -- Cierra el mismo hueco que las horas reales: si alguien entra a
    -- 'en_revision' por un UPDATE directo (sin pasar por
    -- submit_task_for_review) y el circuito exige revisor, que no se cuele
    -- sin elegir uno. task_requires_review es por PROYECTO y
    -- task_requires_time_report por TAREA — pueden no coincidir (una tarea
    -- que uno mismo creó, en un proyecto que no es suyo), así que este
    -- chequeo no se puede dar por cubierto por el de arriba.
    if public.task_requires_review(new.project_id) and new.current_reviewer_person_id is null then
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

    -- Termina el circuito (o vuelve al remitente original, que ya es
    -- asignado permanente): nadie "tiene la revisión" hasta la próxima
    -- entrega.
    new.current_reviewer_person_id := null;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Visibilidad y escritura: el revisor elegido puede ver/tocar la tarea
--    aunque no sea el asignado ni la haya creado. El asignado original
--    conserva sus vías de siempre (is_task_assignee/created_by), así que
--    sigue viéndola "quieta" en 'en_revision' mientras no le toca actuar —
--    solo no puede reescribir el estado mientras el revisor actual sea
--    otra persona, y eso lo hacen cumplir los RPCs de arriba, no esta regla.
--
-- OJO — esto reescribe tasks_select_scoped completo (create or replace no
-- admite parches en políticas), así que hay que partir de la versión más
-- reciente (*_devolucion_con_motivo_y_alcance.sql), no de una anterior: esa
-- migración acotó a un Gestor a solo los proyectos que gerencia (antes veía
-- TODO el mes). Una versión de este archivo que llevó esta migración a
-- producción reescribió por error tasks_select_scoped con un patrón viejo
-- ("not is_analista_role() or ...") que para cualquier no-analista es
-- `true` sin más condición — volvía a abrirle a un Gestor las tareas de
-- proyectos ajenos. Se corrige acá, conservando esa migración como la base.
-- ---------------------------------------------------------------------------
drop policy if exists "tasks_select_scoped" on public.tasks;
drop policy if exists "tasks_insert_write" on public.tasks;
drop policy if exists "tasks_update_write" on public.tasks;
drop policy if exists "tasks_delete_write" on public.tasks;

create policy "tasks_select_scoped" on public.tasks
  for select to authenticated
  using (
    public.is_admin()
    or (
      not public.is_analista_role()
      and (
        public.is_project_manager(project_id)
        or created_by = auth.uid()
        or public.is_task_assignee(id)
        or public.is_own_person(current_reviewer_person_id)
      )
    )
    or (
      public.is_analista_role()
      and public.is_month_released(month_id)
      and (
        public.is_task_assignee(id)
        or created_by = auth.uid()
        or public.is_own_person(current_reviewer_person_id)
      )
    )
  );

create policy "tasks_insert_write" on public.tasks
  for insert to authenticated
  with check (
    public.can_write_month(month_id)
    or (
      public.is_analista_role()
      and not public.is_month_locked(month_id)
      and created_by = auth.uid()
    )
  );

create policy "tasks_update_write" on public.tasks
  for update to authenticated
  using (
    public.can_write_month(month_id)
    or (
      public.is_analista_role()
      and not public.is_month_locked(month_id)
      and (
        public.is_task_assignee(id)
        or created_by = auth.uid()
        or public.is_own_person(current_reviewer_person_id)
      )
    )
  )
  with check (
    public.can_write_month(month_id)
    or (
      public.is_analista_role()
      and not public.is_month_locked(month_id)
      and (
        public.is_task_assignee(id)
        or created_by = auth.uid()
        or public.is_own_person(current_reviewer_person_id)
      )
    )
  );

create policy "tasks_delete_write" on public.tasks
  for delete to authenticated using (
    public.can_write_month(month_id)
    or (
      public.is_analista_role()
      and not public.is_month_locked(month_id)
      and (public.is_task_assignee(id) or created_by = auth.uid())
    )
  );

-- Avisos en vivo: el historial también se sincroniza sin recargar. Postgres
-- no tiene "ADD TABLE IF NOT EXISTS" para publicaciones — se ignora a mano
-- el único error posible (ya estaba agregada).
do $$
begin
  alter publication supabase_realtime add table public.task_review_hops;
exception
  when duplicate_object then null;
end $$;
