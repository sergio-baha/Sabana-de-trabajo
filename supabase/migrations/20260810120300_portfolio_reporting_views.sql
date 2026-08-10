-- Consumo contra presupuesto, por proyecto del portafolio y por fase.
--
-- Van CUATRO vistas y no dos por una razón de permisos que no se puede
-- esquivar: las horas y los gastos los puede ver cualquiera que ya vea el
-- portafolio, pero el costo de nómina sale de `person_rates`, que es solo
-- de Administrador. Una sola vista tendría que ser SECURITY DEFINER para
-- leer las tarifas, y al serlo también saltaría el acotamiento de
-- `allocations` que limita al Analista de Tecnología a sus propias horas
-- (*_tasks_schedule_and_rls.sql). Separarlas deja cada mitad con el modo
-- que le corresponde:
--
--   *_totals  security_invoker = true  → respeta el RLS de quien consulta.
--   *_cost    SECURITY DEFINER + filtro explícito a Gestor/Administrador.
--
-- ⚠ Fuga inherente que conviene tener presente: quien puede ver el costo de
-- nómina de un proyecto en el que trabajó UNA sola persona puede deducir su
-- tarifa dividiendo costo entre horas. Restringir el costo a Gestor/Admin
-- acota quién puede hacerlo, pero no lo elimina. Si eso no es aceptable,
-- el costo tendría que quedar solo para Administrador (cambiar
-- `is_gestor_or_admin()` por `is_admin()` en las dos vistas *_cost).

-- ---------------------------------------------------------------------------
-- Proyecto: horas y presupuesto
-- ---------------------------------------------------------------------------
-- Las horas se suman sobre TODAS las filas mensuales del proyecto, de todos
-- los meses: eso es exactamente lo que el modelo por mes no podía responder.
create or replace view public.v_portfolio_project_totals
with (security_invoker = true) as
with hours as (
  select
    pr.portfolio_project_id as portfolio_project_id,
    coalesce(sum(a.hours), 0) as allocated_hours,
    count(distinct a.person_id) as people_count,
    count(distinct pr.month_id) as months_count
  from public.projects pr
  join public.allocations a on a.project_id = pr.id
  where pr.portfolio_project_id is not null
  group by pr.portfolio_project_id
),
expenses as (
  select
    portfolio_project_id,
    coalesce(sum(amount), 0) as expense_total
  from public.project_expenses
  group by portfolio_project_id
)
select
  pp.id as portfolio_project_id,
  pp.name,
  pp.color,
  pp.category,
  pp.status,
  pp.currency,
  pp.start_date,
  pp.end_date,
  pp.budget_amount,
  pp.budget_hours,
  coalesce(h.allocated_hours, 0) as allocated_hours,
  coalesce(h.people_count, 0) as people_count,
  coalesce(h.months_count, 0) as months_count,
  coalesce(e.expense_total, 0) as expense_total,
  -- Horas que quedan del techo. Null si no hay presupuesto de horas
  -- definido — que es distinto de "quedan 0".
  case
    when pp.budget_hours is null then null
    else pp.budget_hours - coalesce(h.allocated_hours, 0)
  end as remaining_hours
from public.portfolio_projects pp
left join hours h on h.portfolio_project_id = pp.id
left join expenses e on e.portfolio_project_id = pp.id;

-- ---------------------------------------------------------------------------
-- Proyecto: costo de nómina
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER (sin security_invoker) para poder leer person_rates. El
-- `where` es la barrera: sin él, cualquier autenticado leería el costo.
create or replace view public.v_portfolio_project_cost as
select
  pr.portfolio_project_id,
  coalesce(sum(a.hours * coalesce(r.hourly_rate, 0)), 0) as labor_cost,
  -- Horas sin tarifa cargada: sin esto, un costo bajo es indistinguible de
  -- "falta registrar la tarifa de media plantilla". La UI lo advierte.
  coalesce(sum(case when r.hourly_rate is null then a.hours else 0 end), 0) as unrated_hours
from public.projects pr
join public.allocations a on a.project_id = pr.id
left join public.person_rates r on r.person_id = a.person_id
where pr.portfolio_project_id is not null
  and public.is_gestor_or_admin()
group by pr.portfolio_project_id;

-- ---------------------------------------------------------------------------
-- Fase: horas y presupuesto
-- ---------------------------------------------------------------------------
-- ⚠ Diferencia importante con el total del proyecto: las horas por fase
-- salen de `activities`, no de `allocations`. Una celda de la grilla solo
-- sabe "esta persona puso 20 h en este proyecto"; para saber a QUÉ fase
-- fueron hay que haberla desglosado en actividades. Por eso la suma de las
-- fases puede ser MENOR que el total del proyecto, y la UI muestra esa
-- diferencia como "horas sin clasificar" en vez de fingir que cuadra.
create or replace view public.v_project_phase_totals
with (security_invoker = true) as
with hours as (
  select
    ac.phase_id,
    coalesce(sum(ac.hours), 0) as allocated_hours
  from public.activities ac
  where ac.phase_id is not null
  group by ac.phase_id
),
expenses as (
  select
    phase_id,
    coalesce(sum(amount), 0) as expense_total
  from public.project_expenses
  where phase_id is not null
  group by phase_id
)
select
  ph.id as phase_id,
  ph.portfolio_project_id,
  ph.name,
  ph.phase_key,
  ph.position,
  ph.status,
  ph.start_date,
  ph.end_date,
  ph.budget_amount,
  ph.budget_hours,
  coalesce(h.allocated_hours, 0) as allocated_hours,
  coalesce(e.expense_total, 0) as expense_total,
  case
    when ph.budget_hours is null then null
    else ph.budget_hours - coalesce(h.allocated_hours, 0)
  end as remaining_hours
from public.project_phases ph
left join hours h on h.phase_id = ph.id
left join expenses e on e.phase_id = ph.id;

-- ---------------------------------------------------------------------------
-- Fase: costo de nómina
-- ---------------------------------------------------------------------------
create or replace view public.v_project_phase_cost as
select
  ac.phase_id,
  coalesce(sum(ac.hours * coalesce(r.hourly_rate, 0)), 0) as labor_cost,
  coalesce(sum(case when r.hourly_rate is null then ac.hours else 0 end), 0) as unrated_hours
from public.activities ac
join public.allocations al on al.id = ac.allocation_id
left join public.person_rates r on r.person_id = al.person_id
where ac.phase_id is not null
  and public.is_gestor_or_admin()
group by ac.phase_id;

-- Las "horas sin clasificar en fases" (la brecha entre el total real y lo
-- desglosado en actividades) NO llevan vista propia: la UI ya tiene ambas
-- cifras cargadas para pintar las barras, y restarlas ahí da exactamente el
-- mismo número que las calcularía acá. Una quinta vista solo agregaría una
-- consulta más por pantalla.

grant select on public.v_portfolio_project_totals to authenticated;
grant select on public.v_portfolio_project_cost to authenticated;
grant select on public.v_project_phase_totals to authenticated;
grant select on public.v_project_phase_cost to authenticated;
