-- Verificación del roster después de la fusión. No cambia nada: solo reporta,
-- para dejar por escrito cómo quedó y detectar de una vez cualquier fila
-- suelta que hubiera sobrevivido a las tres pasadas.
do $$
declare
  d record;
  v_sueltas integer;
begin
  select count(*) into v_sueltas
  from public.people p
  join public.months m on m.id = p.month_id
  where p.profile_id is null and m.status = 'abierto';

  raise notice 'Filas del roster sin cuenta vinculada en meses abiertos: %', v_sueltas;

  for d in
    select m.name as mes,
           count(*) filter (where p.profile_id is not null) as vinculadas,
           count(*) filter (where p.profile_id is null) as sueltas,
           sum((select count(*) from public.allocations a where a.person_id = p.id)) as celdas
    from public.people p
    join public.months m on m.id = p.month_id
    group by m.name
    order by m.name
  loop
    raise notice 'Mes %: % vinculadas, % sueltas, % celdas de horas',
      d.mes, d.vinculadas, d.sueltas, d.celdas;
  end loop;
end;
$$;
