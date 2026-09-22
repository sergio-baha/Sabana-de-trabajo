-- ¿Qué migraciones están REALMENTE aplicadas en la base remota?
--
-- POR QUÉ HACE FALTA: el historial de Supabase (supabase_migrations.schema_migrations)
-- se quedó en 20260827100000, pero la base sí tiene los objetos de las
-- migraciones siguientes — se aplicaron a mano, por el SQL Editor, sin pasar
-- por `supabase db push`. El síntoma es un push que intenta recrear un tipo
-- que ya existe y se detiene.
--
-- La cura es `supabase migration repair --status applied <versión>`, que
-- registra la migración como aplicada sin ejecutarla. Pero antes hay que
-- comprobar que de verdad lo está: marcar como aplicada una que no lo está
-- deja la base atrás del repositorio para siempre, en silencio.
--
-- Este script comprueba, para cada migración no registrada, un objeto que
-- solo existe si esa migración corrió. Las que no aparecen acá son
-- idempotentes (solo `create or replace function` o `drop policy` +
-- `create policy`), así que da igual si se re-ejecutan.
--
-- Se corre en el SQL Editor del Dashboard. No escribe nada.

select '20260827110000 estratega_esquema' as migracion,
       to_regclass('public.estratega_productos') is not null as aplicada
union all
select '20260827120000 estratega_datos_iniciales',
       coalesce((select count(*) from public.estratega_productos), 0) > 0
union all
select '20260828100000 planeacion_lista',
       exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'months'
                 and column_name = 'planning_ready_at')
union all
select '20260828120000 capacidad_del_mes_nuevo',
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'seed_month_people')
union all
select '20260828140000 lineas_de_proyecto',
       to_regclass('public.project_lines') is not null
union all
select '20260828150000 duplicar_copia_lineas',
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'create_month_from_previous'
                 and pg_get_functiondef(p.oid) ilike '%line_id%')
union all
select '20260828160000 subproyecto_obligatorio',
       exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'allocations'
                 and column_name = 'line_id' and is_nullable = 'NO')
union all
select '20260829100000 tareas_solo_asignadas',
       exists (select 1 from pg_policies
               where schemaname = 'public' and tablename = 'tasks'
                 and policyname = 'tasks_select_scoped')
union all
select '20260829120000 revisor_elegido',
       exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'tasks'
                 and column_name = 'current_reviewer_person_id')
union all
-- Ojo: la palabra 'emergente' vive en `task_requires_review`, no en
-- `submit_task_for_review`. Preguntar por la función equivocada daba un
-- falso negativo — que es exactamente el error que este script existe para
-- no cometer al revés.
select '20260830110000 emergente_sin_revision',
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'task_requires_review'
                 and pg_get_functiondef(p.oid) ilike '%emergente%')
union all
select '20260831120000 titulo_y_descripcion_de_actividad',
       exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'activities'
                 and column_name = 'notes')
union all
select '20260901100000 check_planeacion_por_gestor',
       to_regclass('public.month_gestor_checks') is not null
union all
select '20260901110000 correos_liberacion_y_revision',
       exists (select 1 from pg_constraint
               where conname = 'outbox_kind_check'
                 and pg_get_constraintdef(oid) ilike '%mes_liberado%')
order by 1;
