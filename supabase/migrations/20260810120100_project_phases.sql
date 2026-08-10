-- project_phases: las etapas de un proyecto del portafolio.
--
-- Arrancan como las 5 de la metodología de innovación (Descubrir, Definir,
-- Desarrollar, Producto, Entregar — las mismas del spec y del enum
-- `activity_phase`), pero son filas, no un enum: se pueden renombrar,
-- reordenar, quitar y agregar. Los proyectos que no siguen la metodología
-- (una consultoría con "Levantamiento / Piloto / Informe") no tienen que
-- forzar sus etapas dentro de cinco nombres ajenos.
--
-- Cuelgan del portafolio y no de la fila mensual porque una fase cruza
-- meses: "Descubrir" puede ir del 1 de julio al 15 de agosto.

create type public.phase_status as enum ('pendiente', 'en_curso', 'completada');

create table public.project_phases (
  id uuid primary key default gen_random_uuid(),
  portfolio_project_id uuid not null references public.portfolio_projects (id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  -- Marca a cuál de las 5 canónicas corresponde esta fase, cuando aplica.
  -- Sirve para migrar `activities.phase` (que era un enum suelto) y para
  -- que los reportes puedan comparar fases equivalentes entre proyectos.
  -- Queda null en las fases propias que invente cada proyecto.
  phase_key public.activity_phase,
  position smallint not null default 0,
  status public.phase_status not null default 'pendiente',
  start_date date,
  end_date date,
  -- Presupuesto de la fase. La suma de las fases NO se obliga a cuadrar con
  -- el del proyecto: en la práctica se presupuesta el total primero y se
  -- reparte después, y una restricción dura dejaría el proyecto sin poder
  -- guardarse a mitad del reparto. El desajuste se muestra en la UI.
  budget_amount numeric(14, 2) check (budget_amount >= 0),
  budget_hours numeric(10, 2) check (budget_hours >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create index project_phases_project_idx on public.project_phases (portfolio_project_id, position);

-- Una fase canónica no puede repetirse dentro del mismo proyecto (dos
-- "Descubrir" harían ambiguo el mapeo de las actividades migradas). Las
-- fases propias (phase_key null) no tienen esta restricción.
create unique index project_phases_key_unique
  on public.project_phases (portfolio_project_id, phase_key)
  where phase_key is not null;

create trigger set_updated_at
  before update on public.project_phases
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Siembra de las 5 fases por defecto
-- ---------------------------------------------------------------------------
create or replace function public.seed_default_project_phases(p_portfolio_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  -- La columna se llama `position`, que además es una función SQL estándar:
  -- en el alias de la lista de valores se usa `pos` para no depender de cómo
  -- resuelva el parser esa ambigüedad.
  insert into public.project_phases (portfolio_project_id, name, phase_key, position)
  select
    p_portfolio_id,
    d.name,
    d.phase_key,
    d.pos
  from (values
    ('Descubrir',   'descubrir'::public.activity_phase,   0::smallint),
    ('Definir',     'definir'::public.activity_phase,     1::smallint),
    ('Desarrollar', 'desarrollar'::public.activity_phase, 2::smallint),
    ('Producto',    'producto'::public.activity_phase,    3::smallint),
    ('Entregar',    'entregar'::public.activity_phase,    4::smallint)
  ) as d(name, phase_key, pos)
  on conflict do nothing;
$$;

-- Solo la usa el trigger (que la ejecuta con los privilegios del definer):
-- no hay razón para que un cliente pueda sembrar fases en cualquier
-- portafolio saltándose las políticas de project_phases.
revoke all on function public.seed_default_project_phases(uuid) from public, authenticated;

create or replace function public.tg_portfolio_seed_phases()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_project_phases(new.id);
  return new;
end;
$$;

create trigger portfolio_seed_phases
  after insert on public.portfolio_projects
  for each row execute function public.tg_portfolio_seed_phases();

-- Los portafolios que creó el backfill de la migración anterior son
-- anteriores a este trigger: se siembran a mano.
select public.seed_default_project_phases(pp.id) from public.portfolio_projects pp;

-- ---------------------------------------------------------------------------
-- Enlazar el trabajo con su fase
-- ---------------------------------------------------------------------------
-- Las actividades ya traían una fase, pero como enum suelto: no se podía
-- renombrar ni sumar horas contra "la fase Definir DE ESTE proyecto".
-- Ahora apuntan a la fila real.
alter table public.activities
  add column phase_id uuid references public.project_phases (id) on delete set null;

create index activities_phase_idx on public.activities (phase_id);

update public.activities a
set phase_id = ph.id
from public.allocations al
join public.projects pr on pr.id = al.project_id
join public.project_phases ph on ph.portfolio_project_id = pr.portfolio_project_id
where a.allocation_id = al.id
  and a.phase is not null
  and ph.phase_key = a.phase;

-- Ya migrada, la columna enum sobra: mantener las dos sería garantizar que
-- se desincronicen. El tipo `activity_phase` se conserva porque sigue
-- usándose en project_phases.phase_key.
alter table public.activities drop column phase;

-- Las tareas del cronograma también se ubican en una fase, para poder ver
-- el avance de una etapa junto con el trabajo que la compone.
alter table public.tasks
  add column phase_id uuid references public.project_phases (id) on delete set null;

create index tasks_phase_idx on public.tasks (phase_id);

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
alter table public.project_phases enable row level security;

revoke all on public.project_phases from anon;
grant select, insert, update, delete on public.project_phases to authenticated;

-- Mismo criterio que portfolio_projects: las fases son planeación del
-- proyecto, no horas de un mes, así que no dependen de que el mes esté
-- abierto.
create policy "project_phases_select_authenticated" on public.project_phases
  for select to authenticated using (true);

create policy "project_phases_insert_write" on public.project_phases
  for insert to authenticated with check (public.is_gestor_or_admin());

create policy "project_phases_update_write" on public.project_phases
  for update to authenticated
  using (public.is_gestor_or_admin())
  with check (public.is_gestor_or_admin());

create policy "project_phases_delete_write" on public.project_phases
  for delete to authenticated using (public.is_gestor_or_admin());
