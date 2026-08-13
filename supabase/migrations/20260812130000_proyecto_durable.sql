-- FRENTE 1 — El proyecto pasa a ser durable.
--
-- Hasta ahora un proyecto se duplicaba por cada mes (`projects.month_id`) y
-- una segunda tabla, `portfolio_projects`, cargaba la identidad que esa
-- duplicación perdía. El resultado eran dos filas por proyecto, dos
-- formularios, un disparador para mantenerlas en sincronía, y el paso
-- "agregar el proyecto al mes activo" que solo existía por el desdoble.
--
-- A partir de acá: UNA fila por proyecto. El mes queda como lo que siempre
-- fue en realidad — el periodo contra el que se reparten horas — y esa
-- dimensión ya vive donde corresponde, en `allocations.month_id`.
--
-- POR QUÉ SOBREVIVE `projects` Y NO `portfolio_projects`:
-- porque `tasks`, `allocations`, `project_members` y `project_managers` ya
-- apuntan a `projects.id`. Conservar esos ids deja intactas las tareas en
-- producción — incluidas las de la única cuenta que hoy usa la plataforma.
-- La dirección contraria habría reescrito cada una de esas referencias.
--
-- SEGURO PORQUE la relación es 1:1 verificada (23 ↔ 23, cero huérfanos en
-- ambos sentidos) y hoy existe un solo mes, así que ninguna fila de
-- `projects` es una copia mensual de otra.

-- ---------------------------------------------------------------------------
-- 1. Fuera las vistas que dependen de lo que va a cambiar
-- ---------------------------------------------------------------------------
-- Van primero: Postgres no deja soltar una columna de la que cuelga una
-- vista. `v_manager_month_totals` en particular lee project_managers.month_id,
-- que desaparece en el paso 4.
drop view if exists public.v_portfolio_project_totals;
drop view if exists public.v_portfolio_project_cost;
drop view if exists public.v_project_phase_totals;
drop view if exists public.v_project_phase_cost;
drop view if exists public.v_project_month_totals;
drop view if exists public.v_manager_month_totals;

-- ---------------------------------------------------------------------------
-- 1b. Fuera también las políticas que leen esas columnas
-- ---------------------------------------------------------------------------
-- Igual que con las vistas: una política que menciona `portfolio_project_id`
-- o `month_id` impide soltar esa columna. Se recrean en el paso 7 con el
-- criterio nuevo.
drop policy "projects_insert_write" on public.projects;
drop policy "projects_update_write" on public.projects;
drop policy "projects_delete_write" on public.projects;

drop policy "project_managers_insert_write" on public.project_managers;
drop policy "project_managers_update_write" on public.project_managers;
drop policy "project_managers_delete_write" on public.project_managers;

drop policy "project_members_insert_write" on public.project_members;
drop policy "project_members_delete_write" on public.project_members;

drop policy "project_phases_insert_write" on public.project_phases;
drop policy "project_phases_update_write" on public.project_phases;
drop policy "project_phases_delete_write" on public.project_phases;

-- ---------------------------------------------------------------------------
-- 2. La identidad durable se muda a `projects`
-- ---------------------------------------------------------------------------
alter table public.projects
  add column start_date date,
  add column end_date date,
  add column budget_amount numeric(14, 2) check (budget_amount >= 0),
  add column budget_hours numeric(10, 2) check (budget_hours >= 0),
  add column currency text not null default 'COP' check (char_length(currency) = 3);

update public.projects pr
set start_date    = pp.start_date,
    end_date      = pp.end_date,
    budget_amount = pp.budget_amount,
    budget_hours  = pp.budget_hours,
    currency      = pp.currency
from public.portfolio_projects pp
where pp.id = pr.portfolio_project_id;

alter table public.projects
  add constraint projects_dates_ordered
    check (end_date is null or start_date is null or end_date >= start_date);

-- ---------------------------------------------------------------------------
-- 3. Fases y gastos pasan a colgar del proyecto
-- ---------------------------------------------------------------------------
alter table public.project_phases add column project_id uuid;
update public.project_phases ph
set project_id = pr.id
from public.projects pr
where pr.portfolio_project_id = ph.portfolio_project_id;

alter table public.project_expenses add column project_id uuid;
update public.project_expenses ex
set project_id = pr.id
from public.projects pr
where pr.portfolio_project_id = ex.portfolio_project_id;

-- Si algo no mapeó, la migración se detiene antes de romper referencias.
do $$
declare v_orphans int;
begin
  select (select count(*) from public.project_phases where project_id is null)
       + (select count(*) from public.project_expenses where project_id is null)
  into v_orphans;
  if v_orphans > 0 then
    raise exception 'Quedaron % filas sin proyecto al remapear fases/gastos', v_orphans;
  end if;
end $$;

alter table public.project_phases
  alter column project_id set not null,
  add constraint project_phases_project_id_fkey
    foreign key (project_id) references public.projects (id) on delete cascade,
  drop column portfolio_project_id;

alter table public.project_expenses
  alter column project_id set not null,
  add constraint project_expenses_project_id_fkey
    foreign key (project_id) references public.projects (id) on delete cascade,
  drop column portfolio_project_id;

create index project_phases_project_idx on public.project_phases (project_id, position);
create index project_expenses_project_idx on public.project_expenses (project_id);

-- ---------------------------------------------------------------------------
-- 4. El equipo deja de reiniciarse cada mes
-- ---------------------------------------------------------------------------
-- `project_members` y `project_managers` eran por mes, así que duplicar un
-- mes obligaba a rearmar los equipos a mano. Con proyectos durables, el
-- equipo es del proyecto.
alter table public.project_members drop column month_id;
alter table public.project_managers drop column month_id;

-- ---------------------------------------------------------------------------
-- 5. Se retira el desdoble
-- ---------------------------------------------------------------------------
drop trigger if exists project_ensure_portfolio on public.projects;
drop function if exists public.tg_project_ensure_portfolio();

alter table public.projects
  drop column portfolio_project_id,
  drop column cloned_from_id,
  -- Con esto, borrar un mes deja de arrastrarse los proyectos: la llave
  -- foránea era ON DELETE CASCADE, que es como desapareció el mes anterior
  -- con todo su contenido.
  drop column month_id;

drop table public.portfolio_projects;

-- ---------------------------------------------------------------------------
-- 6. Un solo predicado para "puedo gestionar este proyecto"
-- ---------------------------------------------------------------------------
-- `can_manage_portfolio_project` y `is_project_team_member` decían casi lo
-- mismo con dos nombres. Se deja uno, nombrado por intención.
create or replace function public.can_manage_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_gestor_or_admin() or public.is_project_team_member(p_project_id);
$$;

revoke all on function public.can_manage_project(uuid) from public;
grant execute on function public.can_manage_project(uuid) to authenticated;

drop function if exists public.can_manage_portfolio_project(uuid);

-- ---------------------------------------------------------------------------
-- 7. Políticas que dependían del mes o del portafolio
-- ---------------------------------------------------------------------------
-- Al crear todavía no hay proyecto sobre el cual evaluar pertenencia, así
-- que se mantiene el criterio previo menos la condición del mes.
create policy "projects_insert_write" on public.projects
  for insert to authenticated
  with check (public.is_gestor_or_admin() or public.is_analista_role());

create policy "projects_update_write" on public.projects
  for update to authenticated
  using (public.can_manage_project(id))
  with check (public.can_manage_project(id));

-- Borrar sigue siendo de Gestor/Administrador: se lleva por delante horas,
-- tareas y fases.
create policy "projects_delete_write" on public.projects
  for delete to authenticated using (public.is_gestor_or_admin());

create policy "project_managers_insert_write" on public.project_managers
  for insert to authenticated with check (public.can_manage_project(project_id));
create policy "project_managers_update_write" on public.project_managers
  for update to authenticated
  using (public.can_manage_project(project_id))
  with check (public.can_manage_project(project_id));
create policy "project_managers_delete_write" on public.project_managers
  for delete to authenticated using (public.can_manage_project(project_id));

-- El alta no puede exigir pertenencia: quien arma el equipo por primera vez
-- todavía no es parte de él. Mismo razonamiento que en tasks_insert_write.
create policy "project_members_insert_write" on public.project_members
  for insert to authenticated
  with check (public.is_gestor_or_admin() or public.is_analista_role());
create policy "project_members_delete_write" on public.project_members
  for delete to authenticated using (public.can_manage_project(project_id));

create policy "project_phases_insert_write" on public.project_phases
  for insert to authenticated with check (public.can_manage_project(project_id));
create policy "project_phases_update_write" on public.project_phases
  for update to authenticated
  using (public.can_manage_project(project_id))
  with check (public.can_manage_project(project_id));
create policy "project_phases_delete_write" on public.project_phases
  for delete to authenticated using (public.can_manage_project(project_id));

-- ---------------------------------------------------------------------------
-- 8. Vistas de reporte sobre el modelo unificado
-- ---------------------------------------------------------------------------
-- Por mes: ahora el mes lo aporta `allocations`, no el proyecto. Un proyecto
-- aparece en un mes si tiene reparto de horas en ese mes — que es también el
-- criterio con el que la grilla de Distribución decide qué mostrar.
create view public.v_project_month_totals
with (security_invoker = true) as
select
  a.month_id,
  pr.id as project_id,
  pr.name,
  pr.color,
  pr.status,
  coalesce(sum(a.hours), 0) as allocated_hours,
  count(distinct a.person_id) as people_count
from public.projects pr
join public.allocations a on a.project_id = pr.id
group by a.month_id, pr.id, pr.name, pr.color, pr.status;

-- Acumulado de vida del proyecto, sin cortar por mes. Reemplaza a
-- v_portfolio_project_totals; el nombre ya no necesita hablar de portafolio.
create view public.v_project_totals
with (security_invoker = true) as
with hours as (
  select
    a.project_id,
    coalesce(sum(a.hours), 0) as allocated_hours,
    count(distinct a.person_id) as people_count,
    count(distinct a.month_id) as months_count
  from public.allocations a
  group by a.project_id
),
expenses as (
  select project_id, coalesce(sum(amount), 0) as expense_total
  from public.project_expenses
  group by project_id
)
select
  pr.id as project_id,
  pr.name,
  pr.color,
  pr.category,
  pr.status,
  pr.currency,
  pr.start_date,
  pr.end_date,
  pr.budget_amount,
  pr.budget_hours,
  pr.created_by,
  coalesce(h.allocated_hours, 0) as allocated_hours,
  coalesce(h.people_count, 0) as people_count,
  coalesce(h.months_count, 0) as months_count,
  coalesce(e.expense_total, 0) as expense_total,
  case
    when pr.budget_hours is null then null
    else pr.budget_hours - coalesce(h.allocated_hours, 0)
  end as remaining_hours
from public.projects pr
left join hours h on h.project_id = pr.id
left join expenses e on e.project_id = pr.id;

-- Costo de nómina. SECURITY DEFINER (sin security_invoker) para poder leer
-- person_rates; el `where` con is_gestor_or_admin() es la barrera.
create view public.v_project_cost as
select
  a.project_id,
  coalesce(sum(a.hours * coalesce(r.hourly_rate, 0)), 0) as labor_cost,
  coalesce(sum(case when r.hourly_rate is null then a.hours else 0 end), 0) as unrated_hours
from public.allocations a
left join public.person_rates r on r.person_id = a.person_id
where public.is_gestor_or_admin()
group by a.project_id;

-- Por fase. Las horas siguen saliendo de `activities` y no de `allocations`:
-- una celda de la grilla sabe "20 h en este proyecto", pero a QUÉ fase
-- fueron solo lo sabe el desglose en actividades. Por eso la suma de fases
-- puede ser menor que el total del proyecto, y la interfaz muestra esa
-- diferencia como horas sin clasificar en vez de fingir que cuadra.
create view public.v_project_phase_totals
with (security_invoker = true) as
with hours as (
  select ac.phase_id, coalesce(sum(ac.hours), 0) as allocated_hours
  from public.activities ac
  where ac.phase_id is not null
  group by ac.phase_id
),
expenses as (
  select phase_id, coalesce(sum(amount), 0) as expense_total
  from public.project_expenses
  where phase_id is not null
  group by phase_id
)
select
  ph.id as phase_id,
  ph.project_id,
  ph.name,
  ph.phase_key,
  ph.position,
  ph.status,
  ph.start_date,
  ph.end_date,
  ph.budget_amount,
  ph.budget_hours,
  coalesce(h.allocated_hours, 0) as allocated_hours,
  coalesce(e.expense_total, 0) as expense_total
from public.project_phases ph
left join hours h on h.phase_id = ph.id
left join expenses e on e.phase_id = ph.id;

create view public.v_project_phase_cost as
select
  ac.phase_id,
  coalesce(sum(ac.hours * coalesce(r.hourly_rate, 0)), 0) as labor_cost
from public.activities ac
join public.allocations a on a.id = ac.allocation_id
left join public.person_rates r on r.person_id = a.person_id
where ac.phase_id is not null
  and public.is_gestor_or_admin()
group by ac.phase_id;

-- Por gerente y mes. El gerente ya no tiene mes propio, así que el corte
-- mensual lo aportan las horas.
create view public.v_manager_month_totals
with (security_invoker = true) as
select
  a.month_id,
  pm.person_id as manager_id,
  mgr.name as manager_name,
  coalesce(sum(a.hours), 0) as allocated_hours,
  count(distinct pm.project_id) as projects_count
from public.project_managers pm
join public.people mgr on mgr.id = pm.person_id
join public.allocations a on a.project_id = pm.project_id
group by a.month_id, pm.person_id, mgr.name;

grant select on public.v_project_month_totals to authenticated;
grant select on public.v_project_totals to authenticated;
grant select on public.v_project_cost to authenticated;
grant select on public.v_project_phase_totals to authenticated;
grant select on public.v_project_phase_cost to authenticated;
grant select on public.v_manager_month_totals to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Duplicar un mes copia el REPARTO, no el catálogo
-- ---------------------------------------------------------------------------
-- Antes clonaba proyectos, tareas, equipos y fases, y era la causa de que
-- las mismas tareas aparecieran dos veces. Con proyectos durables no hay
-- nada de eso que copiar: un mes nuevo es un roster y un reparto de horas.
create or replace function public.create_month_from_previous(
  p_source_month_id uuid,
  p_new_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_month_id uuid;
  v_source public.months%rowtype;
begin
  if not public.is_gestor_or_admin() then
    raise exception 'No tiene permisos para crear un mes';
  end if;

  select * into v_source from public.months where id = p_source_month_id;
  if not found then
    raise exception 'El mes de origen no existe';
  end if;

  insert into public.months (name, status, default_hours, working_days, notes, source_month_id, created_by)
  values (p_new_name, 'abierto', v_source.default_hours, v_source.working_days, v_source.notes, p_source_month_id, auth.uid())
  returning id into v_new_month_id;

  create temporary table _people_map (old_id uuid primary key, new_id uuid not null) on commit drop;

  insert into _people_map (old_id, new_id)
  select id, gen_random_uuid() from public.people where month_id = p_source_month_id;

  insert into public.people (id, month_id, name, job_title, available_hours, status, notes, profile_id, cloned_from_id, created_by)
  select m.new_id, v_new_month_id, p.name, p.job_title, p.available_hours, p.status, p.notes, p.profile_id, p.id, auth.uid()
  from public.people p
  join _people_map m on m.old_id = p.id
  where p.month_id = p_source_month_id;

  insert into public.person_rates (person_id, month_id, hourly_rate, updated_by)
  select pem.new_id, v_new_month_id, r.hourly_rate, auth.uid()
  from public.person_rates r
  join _people_map pem on pem.old_id = r.person_id
  where r.month_id = p_source_month_id;

  -- El reparto se copia tal cual: mismos proyectos (ya durables), personas
  -- nuevas del roster del mes.
  insert into public.allocations (month_id, person_id, project_id, hours, updated_by)
  select v_new_month_id, pem.new_id, a.project_id, a.hours, auth.uid()
  from public.allocations a
  join _people_map pem on pem.old_id = a.person_id
  where a.month_id = p_source_month_id;

  return v_new_month_id;
end;
$$;

revoke all on function public.create_month_from_previous(uuid, text) from public;
grant execute on function public.create_month_from_previous(uuid, text) to authenticated;
