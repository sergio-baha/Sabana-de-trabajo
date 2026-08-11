-- Gestionar fases deja de ser exclusivo de Gestor/Administrador: quien creó
-- el proyecto, o quien figura como gerente o miembro del equipo en
-- CUALQUIER mes de ese proyecto, también puede agregar, editar, reordenar o
-- quitar sus fases. El resto de proyectos del portafolio se sigue viendo
-- (project_phases_select_authenticated no cambia), solo en modo consulta.
--
-- `exists` recorre TODAS las filas mensuales del proyecto (no solo la del
-- mes activo) porque el equipo/gerente es un dato por mes, y alguien puede
-- haber sido parte del proyecto en un mes distinto al que está abierto hoy.
create or replace function public.can_manage_portfolio_project(p_portfolio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_gestor_or_admin()
    or exists (
      select 1 from public.portfolio_projects pp
      where pp.id = p_portfolio_id and pp.created_by = auth.uid()
    )
    or exists (
      select 1
      from public.projects pr
      join public.people pe on pe.profile_id = auth.uid()
      where pr.portfolio_project_id = p_portfolio_id
        and (
          exists (
            select 1 from public.project_members mem
            where mem.project_id = pr.id and mem.person_id = pe.id
          )
          or exists (
            select 1 from public.project_managers mgr
            where mgr.project_id = pr.id and mgr.person_id = pe.id
          )
        )
    );
$$;

revoke all on function public.can_manage_portfolio_project(uuid) from public;
grant execute on function public.can_manage_portfolio_project(uuid) to authenticated;

drop policy "project_phases_insert_write" on public.project_phases;
drop policy "project_phases_update_write" on public.project_phases;
drop policy "project_phases_delete_write" on public.project_phases;

create policy "project_phases_insert_write" on public.project_phases
  for insert to authenticated
  with check (public.can_manage_portfolio_project(portfolio_project_id));

create policy "project_phases_update_write" on public.project_phases
  for update to authenticated
  using (public.can_manage_portfolio_project(portfolio_project_id))
  with check (public.can_manage_portfolio_project(portfolio_project_id));

create policy "project_phases_delete_write" on public.project_phases
  for delete to authenticated using (public.can_manage_portfolio_project(portfolio_project_id));
