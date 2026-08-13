-- Pasa a la categoría `emergente` los proyectos que ya se venían nombrando
-- así. Antes de que existiera la categoría, la única forma de marcarlos era
-- ponerles "Emergente" en el nombre; ahora eso es un dato de verdad y no una
-- convención escrita a mano.
--
-- El nombre se deja como está: renombrarlos sería otra decisión y no la
-- pidió nadie. Si más adelante estorba tener "Emergente" repetido en el
-- nombre y en la categoría, se limpia aparte.
do $$
declare
  d record;
  v_total integer := 0;
begin
  for d in
    select id, name
    from public.projects
    where category <> 'emergente'
      and name ilike '%emergente%'
    order by created_at
  loop
    update public.projects set category = 'emergente' where id = d.id;
    raise notice 'Reclasificado como emergente: %', d.name;
    v_total := v_total + 1;
  end loop;

  raise notice 'Proyectos movidos a emergente: %', v_total;
  raise notice 'Total de emergentes ahora: %',
    (select count(*) from public.projects where category = 'emergente');
end;
$$;
