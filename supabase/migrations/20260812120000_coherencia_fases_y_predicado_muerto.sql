-- Coherencia (frentes 3 y 4 de la revisión de arquitectura). Dos cambios
-- acotados, ninguno toca tareas, asignaciones ni el rol Analista de
-- Tecnología — que es la única cuenta en uso productivo.

-- ---------------------------------------------------------------------------
-- 1. Predicado muerto
-- ---------------------------------------------------------------------------
-- `can_write_own_work` quedó sin uso cuando las políticas de `tasks` pasaron
-- a decidirse por pertenencia al proyecto y por asignación. Se verificó que
-- no lo referencia ninguna política ni ninguna otra función antes de
-- borrarlo. Dejarlo invita a que alguien lo reutilice creyendo que sigue
-- siendo la regla vigente, cuando ya no lo es.
drop function if exists public.can_write_own_work(uuid, uuid);

-- ---------------------------------------------------------------------------
-- 2. Las fases dejan de sembrarse solas
-- ---------------------------------------------------------------------------
-- Cada proyecto nuevo nacía con las cinco fases de la metodología. Resultado
-- medido: 115 fases creadas, 5 con alguna tarea. El detalle de un proyecto
-- abría con cinco secciones vacías que hay que leer para descubrir que no
-- dicen nada.
--
-- Se retira solo el disparador. `seed_default_project_phases()` se conserva:
-- sigue siendo la forma correcta de crear el juego completo de una vez, y la
-- interfaz puede ofrecerlo como acción explícita ("usar la metodología")
-- cuando el proyecto sí la siga.
drop trigger if exists portfolio_seed_phases on public.portfolio_projects;

-- Las fases ya existentes NO se tocan: hay proyectos con tareas colgando de
-- ellas, y borrar las vacías sería una limpieza de datos, no un cambio de
-- comportamiento. Si más adelante se quiere depurar, es una decisión aparte.
