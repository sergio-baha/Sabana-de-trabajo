-- Vincula el roster de un mes (people) con las cuentas de la aplicación
-- (profiles). Hasta ahora eran dos mundos separados: `people` son filas de
-- un mes concreto (se duplican al crear el mes siguiente) y `profiles` son
-- los usuarios que inician sesión. Sin este puente es imposible expresar
-- "cada quien ve solo lo suyo", porque las tareas y las horas se asignan a
-- una persona del roster, no a una cuenta.
--
-- Es opcional (nullable): hay personas del roster que no tienen cuenta en la
-- plataforma, y eso sigue siendo válido.
alter table public.people
  add column profile_id uuid references public.profiles (id) on delete set null;

create index people_profile_idx on public.people (profile_id);

-- Una cuenta no puede estar vinculada a dos personas del mismo mes: si lo
-- estuviera, "mis tareas" devolvería dos rosters distintos y las horas se
-- contarían dos veces. Entre meses distintos sí se repite (es el mismo
-- usuario en el roster de cada mes).
create unique index people_month_profile_idx
  on public.people (month_id, profile_id)
  where profile_id is not null;

-- Funciones de apoyo para las políticas RLS del rol Analista de Tecnología.
create or replace function public.is_analista_tecnologia()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'analista_tecnologia' and is_active
  );
$$;

-- ¿Esta fila del roster corresponde al usuario actual? Devuelve false para
-- p_person_id null, de modo que el trabajo sin asignar queda fuera de "lo
-- mío" en vez de ser visible para todos.
create or replace function public.is_own_person(p_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.people
    where id = p_person_id and profile_id = auth.uid()
  );
$$;

-- ¿Esta celda de la grilla es de la persona vinculada al usuario actual?
create or replace function public.is_own_allocation(p_allocation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.allocations a
    join public.people p on p.id = a.person_id
    where a.id = p_allocation_id and p.profile_id = auth.uid()
  );
$$;

-- El Analista de Tecnología escribe sobre lo suyo mientras el mes siga
-- abierto. Cerrar el mes lo congela igual que a un Gestor; solo un
-- administrador sigue pudiendo escribir después.
create or replace function public.can_write_own_work(p_month_id uuid, p_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_analista_tecnologia()
    and not public.is_month_locked(p_month_id)
    and public.is_own_person(p_person_id);
$$;

-- create_month_from_previous debe arrastrar `profile_id` al mes nuevo, o el
-- analista perdería el acceso a su propio trabajo en cuanto se abriera el
-- mes siguiente. Se actualiza en la migración *_tasks_schedule_and_rls.sql,
-- junto con el otro campo nuevo que también hay que copiar (start_date),
-- para reescribir la función una sola vez.
