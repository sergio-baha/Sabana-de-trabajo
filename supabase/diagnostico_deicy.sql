-- Solo lectura. Corre esto en el SQL Editor (ahí no aplica RLS, así que
-- muestra la verdad completa, borradas aparte).

-- 1) ¿Septiembre sigue "en preparación"? Si released_at es NULL, ningún
--    Analista (incluido Analista de Tecnología) ve sus tareas de ese mes,
--    aunque sigan existiendo intactas.
select name, status, released_at, released_by
from public.months
order by created_at desc
limit 6;

-- 2) ¿Existe Deicy como persona/cuenta en el sistema?
select p.id as person_id, p.name, p.month_id, m.name as mes,
       p.profile_id, pr.role, pr.full_name, pr.is_active
from public.people p
left join public.profiles pr on pr.id = p.profile_id
left join public.months m on m.id = p.month_id
where p.name ilike '%deicy%' or p.name ilike '%deisy%';

-- 3) Sus tareas: existen o no, sin importar RLS. Ajusta el filtro de nombre
--    si el resultado de arriba usa otra grafía (Deisy/Deicy).
select t.id, t.title, t.status, t.month_id, m.name as mes,
       t.created_by, t.created_at, t.updated_at
from public.tasks t
join public.months m on m.id = t.month_id
where t.created_by in (
        select id from public.profiles where full_name ilike '%deicy%' or full_name ilike '%deisy%'
      )
   or exists (
        select 1 from public.task_assignees ta
        join public.people pe on pe.id = ta.person_id
        where ta.task_id = t.id and (pe.name ilike '%deicy%' or pe.name ilike '%deisy%')
      )
order by t.created_at desc;
