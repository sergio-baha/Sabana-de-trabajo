-- Líneas de proyecto: un mismo proyecto puede tener varios frentes de
-- trabajo en la sábana, cada uno con sus propias horas por persona.
--
-- POR QUÉ NO ES "CREAR OTRO PROYECTO"
-- Crear un segundo proyecto con el mismo nombre da dos filas independientes,
-- pero también dos filas en Reportes, dos tarjetas en Proyectos, dos
-- gerentes que asignar por separado — es un proyecto nuevo de verdad, no un
-- segundo frente del mismo. Lo que hacía falta es más angosto: la MISMA
-- identidad de proyecto (mismo gerente, mismo presupuesto, mismas tareas),
-- con más de una fila de horas en la sábana.
--
-- POR QUÉ NO SON "FASES"
-- El proyecto ya tiene Fases (fechas, presupuesto y cronograma propio, ver
-- *_project_phases.sql y FasesTimeline). Se evaluó reusarlas para esto, pero
-- una Fase es un tramo del tiempo del proyecto completo, no una división de
-- CAPACIDAD dentro de un mismo mes — mezclar los dos conceptos habría hecho
-- que crear una fase (para planear el cronograma) también partiera la
-- sábana, que es un efecto que nadie pidió. Las líneas son un concepto
-- aparte, sin fecha ni presupuesto propio: solo dan una fila más.
--
-- EL MODELO
-- Un proyecto SIN líneas se comporta exactamente igual que hoy: una fila en
-- la sábana, `allocations.line_id` en null. Agregarle una línea NO reemplaza
-- esa fila — la línea es una fila ADICIONAL. Así ningún proyecto existente
-- cambia de comportamiento hasta que alguien decide explícitamente dividirlo.
create table public.project_lines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  position smallint not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_lines_project_idx on public.project_lines (project_id, position);

create trigger set_updated_at
  before update on public.project_lines
  for each row execute function public.tg_set_updated_at();

alter table public.project_lines enable row level security;

revoke all on public.project_lines from anon;
grant select, insert, update, delete on public.project_lines to authenticated;

create policy "project_lines_select_authenticated" on public.project_lines
  for select to authenticated using (true);

-- Quién puede crear/renombrar/borrar una línea: el mismo que puede
-- gestionar el proyecto al que pertenece (`can_manage_project`, de
-- *_proyecto_durable.sql) — Gestor/Administrador, o el equipo del proyecto.
create policy "project_lines_write" on public.project_lines
  for all to authenticated
  using (public.can_manage_project(project_id))
  with check (public.can_manage_project(project_id));

-- ---------------------------------------------------------------------------
-- allocations: la celda gana una dimensión más.
-- ---------------------------------------------------------------------------
alter table public.allocations
  add column line_id uuid references public.project_lines (id) on delete cascade;

-- Una línea es del MISMO proyecto que la celda que la usa. Sin esto, nada
-- impediría anotar en una celda de "Proyecto A" una línea que en realidad
-- pertenece a "Proyecto B" — un error de referencia silencioso que solo se
-- notaría cuando los números de un proyecto no cuadraran con los del otro.
create or replace function public.tg_allocation_line_matches_project()
returns trigger
language plpgsql
as $$
begin
  if new.line_id is not null and not exists (
    select 1 from public.project_lines
    where id = new.line_id and project_id = new.project_id
  ) then
    raise exception 'La línea no pertenece a este proyecto';
  end if;
  return new;
end;
$$;

drop trigger if exists allocation_line_matches_project on public.allocations;

create trigger allocation_line_matches_project
  before insert or update of line_id, project_id on public.allocations
  for each row execute function public.tg_allocation_line_matches_project();

-- La restricción única pasa de (mes, persona, proyecto) a (mes, persona,
-- proyecto, línea). `NULLS NOT DISTINCT` (PG 15+) es la pieza que hace que
-- esto siga siendo un candado de verdad para los proyectos SIN líneas: por
-- defecto Postgres trata cada NULL como distinto de cualquier otro, así que
-- sin esta cláusula dos filas con line_id en null habrían podido coexistir
-- para el mismo mes+persona+proyecto — exactamente el problema que esta
-- restricción existe para evitar.
alter table public.allocations
  drop constraint allocations_month_id_person_id_project_id_key;

alter table public.allocations
  add constraint allocations_month_person_project_line_key
  unique nulls not distinct (month_id, person_id, project_id, line_id);

create index allocations_line_idx on public.allocations (line_id) where line_id is not null;
