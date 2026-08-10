-- portfolio_projects: la identidad de un proyecto A TRAVÉS de los meses.
--
-- Hasta ahora `projects` era una fila por mes: duplicar un mes creaba filas
-- nuevas enlazadas con `cloned_from_id`, y "Uppie HSE" en julio y en agosto
-- eran dos proyectos distintos para la base. Eso alcanza para repartir horas
-- dentro de un mes, pero no para presupuesto ni fases: un presupuesto de
-- $50M no es del mes, es del proyecto completo, y una fase "Descubrir" que
-- va del 1 de julio al 15 de agosto cruza dos meses.
--
-- Esta tabla es esa identidad durable. La fila mensual de `projects` sigue
-- existiendo tal cual (allocations, tasks y comments siguen colgando de
-- ella, sin tocar); lo que se agrega es un puntero al proyecto de
-- portafolio, de modo que todas las filas mensuales de "Uppie HSE" sumen
-- contra el mismo presupuesto.
--
-- Se deja el nombre/color también en la fila mensual a propósito: el
-- histórico no se reescribe. Si un proyecto se renombra hoy, los meses ya
-- cerrados conservan el nombre con el que se trabajaron.

create table public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) > 0),
  color text not null default '#3A5BA7',
  category public.project_category not null default 'proyecto',
  status public.project_status not null default 'activo',
  description text,
  -- Fechas del proyecto completo. Son informativas: las que mandan para el
  -- avance son las de cada fase.
  start_date date,
  end_date date,

  -- Presupuesto del proyecto COMPLETO, no del mes. `null` = sin presupuesto
  -- definido, que es distinto de 0 (presupuesto de cero): con null la UI no
  -- muestra barra de consumo ni alerta de sobrecosto.
  --
  -- numeric(14,2) da hasta 999.999.999.999,99 — suficiente para pesos
  -- colombianos sin acercarse al límite. Nunca float: un presupuesto no
  -- puede arrastrar error de redondeo binario.
  budget_amount numeric(14, 2) check (budget_amount >= 0),
  budget_hours numeric(10, 2) check (budget_hours >= 0),
  -- Se guarda la moneda aunque hoy todo sea COP: el día que aparezca un
  -- proyecto facturado en USD, el dato viejo no queda ambiguo.
  currency text not null default 'COP' check (char_length(currency) = 3),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create index portfolio_projects_status_idx on public.portfolio_projects (status);
create index portfolio_projects_category_idx on public.portfolio_projects (category);

create trigger set_updated_at
  before update on public.portfolio_projects
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Enlace desde la fila mensual
-- ---------------------------------------------------------------------------
-- `on delete set null` y no cascade: borrar un proyecto del portafolio no
-- puede llevarse por delante las horas ya registradas en meses cerrados. La
-- fila mensual queda huérfana de portafolio, que es recuperable; perder
-- allocations no lo es.
alter table public.projects
  add column portfolio_project_id uuid references public.portfolio_projects (id) on delete set null;

create index projects_portfolio_idx on public.projects (portfolio_project_id);

-- ---------------------------------------------------------------------------
-- Backfill: reconstruir el portafolio desde las cadenas de clonado
-- ---------------------------------------------------------------------------
-- Cada cadena `cloned_from_id` (julio → agosto → septiembre) es, en los
-- hechos, un mismo proyecto que ya venía viajando entre meses. Se recorre
-- hasta la raíz y se crea un portfolio_project por raíz, no por fila.
--
-- El id del portafolio se genera ANTES de insertar (gen_random_uuid en el
-- mapeo), igual que en create_month_from_previous: así se conserva la
-- correspondencia raíz → portafolio sin tener que emparejar después por
-- nombre, que fallaría con dos proyectos homónimos en cadenas distintas.
do $$
begin
  -- Recorrido de las cadenas. `cycle` (Postgres 14+) corta si una edición
  -- manual dejó un ciclo, en vez de colgar la migración.
  create temporary table _chain on commit drop as
  with recursive walk as (
    select
      p.id,
      p.id as root_id,
      p.cloned_from_id
    from public.projects p
    -- Raíces: sin padre, o con un padre que ya no existe (el original se
    -- borró y el `on delete set null` dejó la referencia colgando).
    where p.cloned_from_id is null
       or not exists (select 1 from public.projects q where q.id = p.cloned_from_id)

    union all

    select
      child.id,
      walk.root_id,
      child.cloned_from_id
    from public.projects child
    join walk on child.cloned_from_id = walk.id
  ) cycle id set is_cycle using path
  select id, root_id from walk where not is_cycle;

  -- Un portafolio por raíz de cadena. Los datos de identidad salen de la
  -- fila MÁS RECIENTE de la cadena, no de la raíz: es la que refleja el
  -- nombre y el estado vigentes del proyecto.
  create temporary table _portfolio_map on commit drop as
  select distinct on (c.root_id)
    c.root_id,
    gen_random_uuid() as portfolio_id,
    p.name,
    p.color,
    p.category,
    p.status,
    p.description,
    p.created_by
  from _chain c
  join public.projects p on p.id = c.id
  order by c.root_id, p.created_at desc;

  insert into public.portfolio_projects
    (id, name, color, category, status, description, created_by)
  select m.portfolio_id, m.name, m.color, m.category, m.status, m.description, m.created_by
  from _portfolio_map m;

  update public.projects pr
  set portfolio_project_id = m.portfolio_id
  from _chain c
  join _portfolio_map m on m.root_id = c.root_id
  where pr.id = c.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
alter table public.portfolio_projects enable row level security;

revoke all on public.portfolio_projects from anon;
grant select, insert, update, delete on public.portfolio_projects to authenticated;

-- El portafolio no está atado a un mes, así que `can_write_month` no aplica:
-- escribirlo es potestad de Gestor/Administrador sin importar qué meses
-- estén cerrados. Cerrar un mes congela las HORAS de ese mes, no impide
-- seguir planeando el presupuesto de un proyecto en curso.
create policy "portfolio_projects_select_authenticated" on public.portfolio_projects
  for select to authenticated using (true);

create policy "portfolio_projects_insert_write" on public.portfolio_projects
  for insert to authenticated with check (public.is_gestor_or_admin());

create policy "portfolio_projects_update_write" on public.portfolio_projects
  for update to authenticated
  using (public.is_gestor_or_admin())
  with check (public.is_gestor_or_admin());

create policy "portfolio_projects_delete_write" on public.portfolio_projects
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Toda fila mensual nace con portafolio
-- ---------------------------------------------------------------------------
-- Sin esto, un proyecto creado desde el diálogo de tareas o desde /proyectos
-- quedaría sin identidad durable y no podría llevar presupuesto ni fases.
-- Se resuelve en la base y no en el cliente porque hay tres caminos que
-- insertan en `projects` (el módulo de proyectos, el diálogo de tarea y el
-- RPC de duplicar mes) y los tres deben cumplirlo.
--
-- SECURITY DEFINER a propósito: un Analista puede crear proyectos
-- (canCreateProjects) pero no escribe en portfolio_projects. El trigger es
-- una consecuencia de una acción que ya se le permitió, no una vía para
-- darle permisos que no tiene — solo puede crear el portafolio que
-- corresponde al proyecto que acaba de insertar.
create or replace function public.tg_project_ensure_portfolio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_portfolio_id uuid;
begin
  if new.portfolio_project_id is not null then
    return new;
  end if;

  -- Si viene de un clonado, hereda el portafolio del proyecto de origen en
  -- vez de abrir uno nuevo: es el mismo proyecto un mes después.
  if new.cloned_from_id is not null then
    select portfolio_project_id into v_portfolio_id
    from public.projects where id = new.cloned_from_id;

    if v_portfolio_id is not null then
      new.portfolio_project_id := v_portfolio_id;
      return new;
    end if;
  end if;

  insert into public.portfolio_projects (name, color, category, status, description, created_by)
  values (new.name, new.color, new.category, new.status, new.description, auth.uid())
  returning id into v_portfolio_id;

  new.portfolio_project_id := v_portfolio_id;
  return new;
end;
$$;

create trigger project_ensure_portfolio
  before insert on public.projects
  for each row execute function public.tg_project_ensure_portfolio();
