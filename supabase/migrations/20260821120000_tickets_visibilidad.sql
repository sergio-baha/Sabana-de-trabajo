-- Quién ve y quién reparte los tickets.
--
-- EL PROBLEMA: un ticket entra SIN DUEÑO, y la política vigente de `tasks`
-- deja ver una tarjeta a un analista solo si es del equipo del proyecto, la
-- tiene asignada, o la creó. Un ticket recién llegado no cumple ninguna de
-- las tres — nace invisible para la gente que tiene que atenderlo.
--
-- Es exactamente el agujero que dejó 27 tarjetas fantasma en agosto de 2026
-- al restaurarlas sin responsable. Allá fue un accidente; acá sería el
-- funcionamiento normal, así que la regla se escribe explícita.
--
-- CUIDADO CON `is_analista_role()`: incluye a los DOS analistas (ver
-- *_analyst_task_and_project_creation.sql). La rama nueva usa
-- `is_analista_tecnologia()` a propósito — si usara el predicado amplio, la
-- bandeja de soporte se le abriría también al Analista normal, que no tiene
-- nada que hacer ahí.

-- ---------------------------------------------------------------------------
-- 1. Predicados del rol nuevo
-- ---------------------------------------------------------------------------
create or replace function public.is_coordinador()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'coordinador' and is_active
  );
$$;

revoke all on function public.is_coordinador() from public;
grant execute on function public.is_coordinador() to authenticated;

-- Quién puede repartir tickets: el Coordinador y el Administrador asignan a
-- terceros. El Analista de Tecnología solo puede tomarlos para sí mismo, y
-- eso se resuelve en la política, no acá.
create or replace function public.can_assign_tickets()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_coordinador();
$$;

revoke all on function public.can_assign_tickets() from public;
grant execute on function public.can_assign_tickets() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Ver el trabajo
-- ---------------------------------------------------------------------------
-- Se reescribe entera porque una política no se puede "ampliar": se suelta y
-- se vuelve a crear. Las cuatro vías anteriores se conservan tal cual y se
-- suman dos.
drop policy if exists "tasks_select_scoped" on public.tasks;

create policy "tasks_select_scoped" on public.tasks
  for select to authenticated
  using (
    -- Gestor y Administrador, como siempre: ven el trabajo del equipo.
    not public.is_analista_role()
    -- El Coordinador supervisa: ve el trabajo del equipo aunque no reparta
    -- las horas del mes. Es la mitad "supervisión" de su alcance.
    or public.is_coordinador()
    -- Las tres vías originales del analista.
    or public.is_project_team_member(project_id)
    or public.is_task_assignee(id)
    or created_by = auth.uid()
    -- LA NUEVA: la bandeja de soporte. Todo Analista de Tecnología ve TODOS
    -- los tickets, tengan dueño o no — es lo que permite que alguien tome
    -- uno que llegó sin asignar.
    or (public.is_analista_tecnologia() and ticket_number is not null)
  );

-- ---------------------------------------------------------------------------
-- 3. Trabajar el ticket
-- ---------------------------------------------------------------------------
-- Mover un ticket por el tablero (incluido cerrarlo) es trabajo del Analista
-- de Tecnología sobre la bandeja, no sobre "su" tarjeta: puede tomar uno sin
-- dueño y eso implica poder tocarlo antes de asignárselo.
drop policy if exists "tasks_update_write" on public.tasks;

create policy "tasks_update_write" on public.tasks
  for update to authenticated
  using (
    public.can_write_month(month_id)
    or public.is_task_assignee(id)
    or (public.is_analista_tecnologia() and ticket_number is not null)
    or (public.can_assign_tickets() and ticket_number is not null)
  )
  with check (
    public.can_write_month(month_id)
    or public.is_task_assignee(id)
    or (public.is_analista_tecnologia() and ticket_number is not null)
    or (public.can_assign_tickets() and ticket_number is not null)
  );

-- ---------------------------------------------------------------------------
-- 4. Repartir
-- ---------------------------------------------------------------------------
-- Dos vías nuevas sobre las que ya existían:
--   · El Analista de Tecnología se asigna un ticket A SÍ MISMO. La condición
--     `pe.profile_id = auth.uid()` es la que impide que se lo endose a otro.
--   · El Coordinador y el Administrador asignan a quien corresponda.
drop policy if exists "task_assignees_insert_write" on public.task_assignees;

create policy "task_assignees_insert_write" on public.task_assignees
  for insert to authenticated
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_assignees.task_id
        and (
          public.can_write_month(t.month_id)
          or (
            public.is_analista_role()
            and (
              public.is_project_team_member(t.project_id)
              or t.created_by = auth.uid()
            )
          )
          -- Tomar un ticket para sí mismo.
          or (
            t.ticket_number is not null
            and public.is_analista_tecnologia()
            and exists (
              select 1 from public.people pe
              where pe.id = task_assignees.person_id
                and pe.profile_id = auth.uid()
            )
          )
          -- Repartirlo a quien toque.
          or (t.ticket_number is not null and public.can_assign_tickets())
        )
    )
  );

-- Soltar un ticket: mismo criterio. Un analista puede devolver a la bandeja
-- el que tomó, y quien reparte puede reasignar.
drop policy if exists "task_assignees_delete_write" on public.task_assignees;

create policy "task_assignees_delete_write" on public.task_assignees
  for delete to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_assignees.task_id
        and (
          public.can_write_month(t.month_id)
          or (
            public.is_analista_role()
            and (
              public.is_project_team_member(t.project_id)
              or t.created_by = auth.uid()
            )
          )
          or (
            t.ticket_number is not null
            and public.is_analista_tecnologia()
            and exists (
              select 1 from public.people pe
              where pe.id = task_assignees.person_id
                and pe.profile_id = auth.uid()
            )
          )
          or (t.ticket_number is not null and public.can_assign_tickets())
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Comentar
-- ---------------------------------------------------------------------------
-- La política de `task_comments` cuelga de poder VER la tarea, así que se
-- amplía sola con el punto 2: quien ve el ticket puede comentarlo. Se deja
-- dicho para que nadie la busque creyendo que falta.
