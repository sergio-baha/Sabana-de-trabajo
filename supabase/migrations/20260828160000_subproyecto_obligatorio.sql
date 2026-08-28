-- El modelo de "líneas" (fila extra opcional) no alcanzó: ahora todo
-- proyecto DEBE tener al menos un subproyecto. Al crear un proyecto se le
-- crea automático uno con su mismo nombre, y la sábana ya no tiene una "fila
-- base sin línea" — cada fila es siempre projectId + un subproyecto real.
-- Se mantienen los nombres de tabla/columna (project_lines / line_id) del
-- migration anterior: renombrarlos no aporta nada y sí arriesga romper FKs
-- sobre datos que ya pueden tener horas cargadas (cargue de septiembre).

-- 1) Todo proyecto que todavía no tenga ningún subproyecto recibe uno con su
--    mismo nombre. Cubre los proyectos históricos, de antes de que existiera
--    este concepto.
insert into public.project_lines (project_id, name, position)
select p.id, p.name, 0
from public.projects p
where not exists (
  select 1 from public.project_lines pl where pl.project_id = p.id
);

-- 2) Toda asignación (allocations) que todavía apunte a la "fila base"
--    (line_id null) se reasigna al subproyecto por defecto de su proyecto:
--    el de posición más baja (el recién creado en el paso 1, o el que ya
--    existiera con ese rol si el proyecto nunca tuvo líneas explícitas).
--
-- Un proyecto que YA tenía líneas explícitas (ej. Uppie con Formación /
-- Empresarial, del cargue de septiembre) puede además tener una fila base
-- residual de antes de que existieran las líneas, para la misma persona+mes.
-- Reasignarla directo chocaría con la fila que ya existe en esa combinación
-- (mes, persona, proyecto, línea) — así que primero se fusionan sumando las
-- horas y borrando la residual, y solo al final se reasignan las que quedan
-- sueltas (esas sí pueden actualizarse directo, no tienen con qué chocar).
with fusiones as (
  select
    base.id as base_id,
    destino.id as destino_id,
    base.hours as base_hours
  from public.allocations base
  join public.allocations destino
    on destino.month_id = base.month_id
   and destino.person_id = base.person_id
   and destino.project_id = base.project_id
   and destino.line_id = (
     select pl.id from public.project_lines pl
     where pl.project_id = base.project_id
     order by pl.position asc
     limit 1
   )
  where base.line_id is null
)
update public.allocations destino
set hours = destino.hours + fusiones.base_hours
from fusiones
where destino.id = fusiones.destino_id;

delete from public.allocations base
using (
  select
    base.id as base_id
  from public.allocations base
  join public.allocations destino
    on destino.month_id = base.month_id
   and destino.person_id = base.person_id
   and destino.project_id = base.project_id
   and destino.line_id = (
     select pl.id from public.project_lines pl
     where pl.project_id = base.project_id
     order by pl.position asc
     limit 1
   )
  where base.line_id is null
) as choques
where base.id = choques.base_id;

update public.allocations a
set line_id = (
  select pl.id
  from public.project_lines pl
  where pl.project_id = a.project_id
  order by pl.position asc
  limit 1
)
where a.line_id is null;

-- 3) Con todo respaldado, line_id pasa a ser obligatorio: ya no existe la
--    fila sin subproyecto.
alter table public.allocations
  alter column line_id set not null;

-- 4) Crear un proyecto debe crear su subproyecto obligatorio en la misma
--    transacción — no queda a criterio del código de la app olvidarlo.
create or replace function public.project_creates_default_line()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_lines (project_id, name, position)
  values (new.id, new.name, 0);
  return new;
end;
$$;

drop trigger if exists tg_project_creates_default_line on public.projects;
create trigger tg_project_creates_default_line
  after insert on public.projects
  for each row execute function public.project_creates_default_line();

-- 5) No se puede borrar el último subproyecto de un proyecto: hacerlo
--    dejaría el proyecto sin ninguno, violando la regla de que siempre debe
--    tener al menos uno.
create or replace function public.project_line_blocks_last_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
begin
  select count(*) into v_remaining
  from public.project_lines
  where project_id = old.project_id and id <> old.id;

  if v_remaining = 0 then
    raise exception 'No puedes borrar el único subproyecto de este proyecto. Todo proyecto necesita al menos uno.'
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists tg_project_line_blocks_last_delete on public.project_lines;
create trigger tg_project_line_blocks_last_delete
  before delete on public.project_lines
  for each row execute function public.project_line_blocks_last_delete();
