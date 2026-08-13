-- Ultimo rastro del modelo viejo: la funcion de trigger que sembraba las
-- fases por defecto de un `portfolio_projects` recien creado.
--
-- El trigger que la disparaba se elimino en
-- 20260812120000_coherencia_fases_y_predicado_muerto.sql (sembraba 5 fases
-- fijas en cada proyecto, y de las 115 creadas asi solo 5 se usaban), pero
-- la funcion quedo colgando sin nadie que la llame. Se va con el nombre
-- "portfolio", que es un concepto que ya no existe en el esquema.
--
-- Se verifica que de verdad este huerfana antes de borrar: si algun trigger
-- la usara, esto falla en vez de romper algo en silencio.
do $$
declare
  v_usos int;
begin
  select count(*) into v_usos
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'tg_portfolio_seed_phases'
    and not t.tgisinternal;

  if v_usos > 0 then
    raise exception 'tg_portfolio_seed_phases todavia la usan % trigger(s)', v_usos;
  end if;
end $$;

drop function if exists public.tg_portfolio_seed_phases();
