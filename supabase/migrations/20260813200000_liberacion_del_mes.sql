-- Liberación del mes: el mes nace "en preparación" y el equipo lo ve cuando
-- el Administrador lo libera, a mano.
--
-- El flujo real de la oficina es: el Administrador abre el mes, los Gestores
-- reparten horas y cargan las actividades, y recién cuando eso está armado se
-- le muestra al resto. Sin esto, un analista veía media sábana a medio hacer y
-- se ponía a trabajar sobre algo que iba a cambiar.
--
-- Por qué una fecha y no un estado nuevo del enum: `month_status` decide si el
-- mes está CONGELADO (`is_month_locked` → cerrado/archivado). Un mes en
-- preparación es lo contrario, está abiertísimo para quien lo prepara; lo que
-- cambia es quién lo ve. Son dos ejes distintos y merecen dos columnas.

alter table public.months
  add column released_at timestamptz,
  add column released_by uuid references public.profiles (id) on delete set null;

-- Los meses que ya existen están en uso: liberados desde siempre. Si se
-- quedaran sin liberar, el equipo perdería de vista su trabajo actual.
update public.months set released_at = created_at where released_at is null;

create or replace function public.is_month_released(p_month_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select released_at is not null from public.months where id = p_month_id),
    false
  );
$$;

revoke all on function public.is_month_released(uuid) from public;
grant execute on function public.is_month_released(uuid) to authenticated;

-- La marca la sella el servidor: quien libera y cuándo no se escriben a mano.
-- La política de update de `months` ya exige Administrador, así que basta con
-- sellar el valor.
create or replace function public.tg_month_seal_release()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.released_at is distinct from old.released_at then
    if new.released_at is null then
      new.released_by := null;
    else
      new.released_at := now();
      new.released_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

create trigger month_seal_release
  before update on public.months
  for each row execute function public.tg_month_seal_release();

-- ---------------------------------------------------------------------------
-- Quién ve un mes sin liberar
-- ---------------------------------------------------------------------------
-- Los dos roles de analista: nada de un mes en preparación — ni el mes en el
-- selector, ni sus tareas, ni sus actividades, ni sus horas. Gestor y
-- Administrador lo ven siempre: son quienes lo arman.
drop policy "months_select_authenticated" on public.months;

create policy "months_select_released" on public.months
  for select to authenticated
  using (not public.is_analista_role() or released_at is not null);

drop policy "tasks_select_scoped" on public.tasks;

create policy "tasks_select_scoped" on public.tasks
  for select to authenticated
  using (
    not public.is_analista_role()
    or (
      public.is_month_released(month_id)
      and (
        public.is_project_team_member(project_id)
        or public.is_task_assignee(id)
        or created_by = auth.uid()
      )
    )
  );

-- La política vigente ya recorta al Analista de Tecnología a sus propias
-- celdas (*_tasks_schedule_and_rls.sql). Se le suma la liberación.
drop policy "activities_select_scoped" on public.activities;

create policy "activities_select_scoped" on public.activities
  for select to authenticated
  using (
    (not public.is_analista_role() or public.is_month_released(month_id))
    and (not public.is_analista_tecnologia() or public.is_own_allocation(allocation_id))
  );

-- `allocations` ya tenía su propio recorte para el Analista de Tecnología
-- (solo las suyas). Se le suma la liberación sin tocar ese criterio.
drop policy if exists "allocations_select_scoped" on public.allocations;
drop policy if exists "allocations_select_authenticated" on public.allocations;

create policy "allocations_select_scoped" on public.allocations
  for select to authenticated
  using (
    (not public.is_analista_role() or public.is_month_released(month_id))
    and (not public.is_analista_tecnologia() or public.is_own_person(person_id))
  );
