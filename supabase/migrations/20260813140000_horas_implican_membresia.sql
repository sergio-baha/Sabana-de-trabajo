-- 1) Repartirle horas a alguien lo hace miembro del proyecto.
--
-- La lista de colaboradores (`project_members`) se llenaba solo a mano desde
-- el formulario del proyecto, así que la grilla y el proyecto podían
-- contradecirse: una persona con 40 h en un proyecto no figuraba en su
-- equipo. Es la misma información dicha dos veces, y la fuente de verdad es
-- la que se usa todos los días — la distribución de horas.
--
-- Va como trigger y no en el cliente porque a `allocations` se escribe desde
-- varios caminos (celda, pegar desde Excel, arrastrar el relleno, duplicar
-- mes) y todos deberían tener el mismo efecto.
--
-- Es ADITIVO a propósito: poner la celda en 0 no saca a nadie del equipo.
-- Puede seguir teniendo tareas del proyecto, y sacarlo es una decisión
-- explícita que se toma desde el formulario del proyecto.
create or replace function public.tg_allocation_implies_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.hours > 0 then
    -- `project_members` no lleva month_id desde *_proyecto_durable.sql: el
    -- equipo es del proyecto, que ya no se duplica cada mes. La fila de
    -- `people` sí es del mes, así que la pertenencia queda anclada al mes por
    -- esa vía.
    insert into public.project_members (project_id, person_id, created_by)
    values (new.project_id, new.person_id, auth.uid())
    on conflict (project_id, person_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists allocation_implies_membership on public.allocations;

create trigger allocation_implies_membership
  after insert or update of hours on public.allocations
  for each row execute function public.tg_allocation_implies_membership();

-- Backfill: lo que ya estaba repartido también es pertenencia.
insert into public.project_members (project_id, person_id)
select distinct a.project_id, a.person_id
from public.allocations a
where a.hours > 0
on conflict (project_id, person_id) do nothing;

-- 2) Los gastos son dato de costo: fuera del alcance del Analista.
--
-- La UI ya no le muestra dinero a ese rol (presupuesto, nómina, gastos). Se
-- cierra también la lectura directa para que no quede una puerta lateral por
-- la API. Las vistas de totales son `security_invoker`, así que para un
-- Analista `expense_total` pasa a ser 0 en vez de fallar — que es justo lo
-- que necesita la UI, donde esa columna ni se pinta.
drop policy if exists "project_expenses_select_authenticated" on public.project_expenses;

create policy "project_expenses_select_gestor_admin" on public.project_expenses
  for select to authenticated using (public.is_gestor_or_admin());
