-- Costo de un proyecto = costo de la gente + gastos externos.
--
-- Las dos piezas van en tablas separadas y con permisos MUY distintos:
--
--   person_rates    tarifa/hora de cada persona. Es dato de nómina. Solo
--                   Administrador puede leerlo o escribirlo.
--   project_expenses gastos que no son nómina (proveedores, viáticos,
--                   licencias). Los ve y registra Gestor/Administrador.
--
-- La tarifa NO se agregó como columna de `people` a propósito: RLS en
-- Postgres es por fila, no por columna, y `people` tiene una política de
-- lectura abierta a todo usuario autenticado
-- (people_select_authenticated). Una columna nueva ahí sería visible para
-- cualquiera que llame a la API — incluido el Analista. Una tabla aparte es
-- la única forma de restringirla de verdad.

-- ---------------------------------------------------------------------------
-- Tarifas por persona
-- ---------------------------------------------------------------------------
-- La tarifa se guarda por persona-mes (people ya es un roster mensual), así
-- que un aumento a mitad de año no reescribe el costo de los meses
-- anteriores: cada mes conserva la tarifa con la que realmente se trabajó.
create table public.person_rates (
  person_id uuid primary key references public.people (id) on delete cascade,
  month_id uuid not null references public.months (id) on delete cascade,
  hourly_rate numeric(12, 2) not null check (hourly_rate >= 0),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index person_rates_month_idx on public.person_rates (month_id);

create trigger set_updated_at
  before update on public.person_rates
  for each row execute function public.tg_set_updated_at();

alter table public.person_rates enable row level security;

revoke all on public.person_rates from anon;
grant select, insert, update, delete on public.person_rates to authenticated;

-- Sin política para el resto de roles: RLS niega por defecto, así que un
-- Gestor que consulte person_rates recibe cero filas. El costo agregado que
-- sí necesita ver lo obtiene por las vistas de la migración siguiente.
create policy "person_rates_admin_all" on public.person_rates
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Gastos del proyecto
-- ---------------------------------------------------------------------------
create table public.project_expenses (
  id uuid primary key default gen_random_uuid(),
  portfolio_project_id uuid not null references public.portfolio_projects (id) on delete cascade,
  -- Un gasto puede no corresponder a ninguna fase concreta (una licencia
  -- anual, por ejemplo): cuenta contra el proyecto y no contra una etapa.
  phase_id uuid references public.project_phases (id) on delete set null,
  -- Mes en que se registró, para poder cruzar el gasto con el consumo de
  -- horas del mismo período. `set null` porque borrar un mes no debería
  -- borrar el rastro contable del gasto.
  month_id uuid references public.months (id) on delete set null,
  incurred_on date not null default current_date,
  concept text not null check (char_length(btrim(concept)) > 0),
  amount numeric(14, 2) not null check (amount >= 0),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_expenses_project_idx on public.project_expenses (portfolio_project_id);
create index project_expenses_phase_idx on public.project_expenses (phase_id);
create index project_expenses_month_idx on public.project_expenses (month_id);

create trigger set_updated_at
  before update on public.project_expenses
  for each row execute function public.tg_set_updated_at();

alter table public.project_expenses enable row level security;

revoke all on public.project_expenses from anon;
grant select, insert, update, delete on public.project_expenses to authenticated;

-- Los gastos no son dato de nómina: los ve cualquiera que ya vea el
-- portafolio, y los escribe quien planea (Gestor/Administrador).
create policy "project_expenses_select_authenticated" on public.project_expenses
  for select to authenticated using (true);

create policy "project_expenses_insert_write" on public.project_expenses
  for insert to authenticated with check (public.is_gestor_or_admin());

create policy "project_expenses_update_write" on public.project_expenses
  for update to authenticated
  using (public.is_gestor_or_admin())
  with check (public.is_gestor_or_admin());

create policy "project_expenses_delete_write" on public.project_expenses
  for delete to authenticated using (public.is_gestor_or_admin());
