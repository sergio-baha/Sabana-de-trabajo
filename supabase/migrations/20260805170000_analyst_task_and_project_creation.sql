-- Dos cambios de alcance en los roles de analista:
--
-- 1. El Analista (a secas) deja de ser de solo lectura en Tareas: pasa a
--    gestionar sus propias tarjetas con exactamente las mismas reglas que el
--    Analista de Tecnología. Los dos roles quedan equivalentes *en Tareas* y
--    se siguen diferenciando en el resto: el Analista ve el trabajo de todo
--    el equipo (grilla, reportes, dashboard) y el Analista de Tecnología no.
--
-- 2. Ambos pueden crear proyectos. Es la válvula de escape del diálogo de
--    tarea: si el proyecto al que pertenece el trabajo todavía no existe en
--    el mes, no tiene sentido bloquear la tarea hasta que un gestor lo cree.
--    Solo *crear*: renombrar, recolorear, cambiar de estado o eliminar un
--    proyecto sigue siendo de Gestor/Administrador.

-- Los dos roles que trabajan "sobre lo suyo". Se separa de
-- is_analista_tecnologia() a propósito: esa función decide qué *ve* cada
-- quien (y solo el Analista de Tecnología tiene la vista recortada), esta
-- decide qué *escribe*.
create or replace function public.is_analista_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('analista', 'analista_tecnologia')
      and is_active
  );
$$;

-- Misma firma y mismo uso que antes (las políticas de `tasks` la siguen
-- llamando sin cambios); lo único que se amplía es a qué roles alcanza.
create or replace function public.can_write_own_work(p_month_id uuid, p_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_analista_role()
    and not public.is_month_locked(p_month_id)
    and public.is_own_person(p_person_id);
$$;

-- projects: crear queda abierto a los analistas con el mes abierto; el resto
-- de operaciones no se toca.
drop policy "projects_insert_write" on public.projects;

create policy "projects_insert_write" on public.projects
  for insert to authenticated
  with check (
    public.can_write_month(month_id)
    or (public.is_analista_role() and not public.is_month_locked(month_id))
  );
