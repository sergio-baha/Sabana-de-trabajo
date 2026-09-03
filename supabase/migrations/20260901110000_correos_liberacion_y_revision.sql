-- Dos correos nuevos, sobre la misma bandeja de salida que ya usan los
-- tickets (public.outbox + outbox-worker por Postmark, ver
-- *_tickets_correo.sql): los triggers arman el texto y encolan, el worker
-- solo transporta — mismo motivo de siempre, no atar el commit de la
-- transacción a que Postmark responda.
--
--   1. Se libera un mes -> correo a todo Gestor y Analista activos (el
--      Analista de Tecnología queda fuera a propósito: su trabajo no se
--      organiza por mes).
--   2. Queda un revisor elegido para una tarea (entrega inicial o
--      reasignación — ver *_revisor_elegido.sql) -> correo a esa persona.

alter table public.outbox drop constraint if exists outbox_kind_check;
alter table public.outbox
  add constraint outbox_kind_check
  check (kind in (
    'ticket_creado', 'ticket_cerrado', 'ticket_reabierto',
    'mes_liberado', 'revision_asignada'
  ));

-- ---------------------------------------------------------------------------
-- 1. Mes liberado
-- ---------------------------------------------------------------------------
create or replace function public.tg_month_release_notifies_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_released_by_name text;
begin
  -- Solo el instante en que PASA a liberado (no cada edición posterior del
  -- mes, y no cuando se vuelve a preparación).
  if new.released_at is null or old.released_at is not null then
    return null;
  end if;

  select full_name into v_released_by_name from public.profiles where id = new.released_by;

  insert into public.outbox (kind, to_email, subject, body)
  select
    'mes_liberado',
    p.email,
    'Ya puedes ver ' || new.name,
    coalesce(v_released_by_name, 'El administrador') || ' liberó "' || new.name || '". ' ||
      'Ya puedes ver tus horas y tus tareas de ese mes en la plataforma:' ||
      chr(10) || chr(10) || 'https://sabana-de-trabajo.pages.dev'
  from public.profiles p
  where p.role in ('gestor', 'analista')
    and p.is_active
    -- Sin esto, un perfil sin correo (no debería pasar, pero `to_email` es
    -- NOT NULL) tumbaría el insert completo y con él la liberación del mes.
    and p.email is not null;

  return null;
end;
$$;

drop trigger if exists month_release_notifies_email on public.months;
create trigger month_release_notifies_email
  after update on public.months
  for each row execute function public.tg_month_release_notifies_email();

-- ---------------------------------------------------------------------------
-- 2. Revisor asignado — entrega inicial (submit_task_for_review) o
--    reasignación (escalate_task_review): las dos formas de tocar esta
--    columna, así que basta un trigger sobre ella.
-- ---------------------------------------------------------------------------
create or replace function public.tg_task_reviewer_notifies_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewer_email text;
  v_actor_name text;
  v_project_name text;
begin
  if new.current_reviewer_person_id is null then
    return null;
  end if;
  if tg_op = 'UPDATE'
     and old.current_reviewer_person_id is not distinct from new.current_reviewer_person_id then
    return null;
  end if;

  select pr.email into v_reviewer_email
  from public.people pe
  join public.profiles pr on pr.id = pe.profile_id
  where pe.id = new.current_reviewer_person_id;

  -- Sin cuenta vinculada no hay a quién escribirle — no debería pasar
  -- (validate_task_reviewer ya lo exige al elegir revisor), pero de fallar
  -- que sea un correo de menos, no una transacción rota.
  if v_reviewer_email is null then
    return null;
  end if;

  select full_name into v_actor_name from public.profiles where id = auth.uid();
  select name into v_project_name from public.projects where id = new.project_id;

  insert into public.outbox (task_id, kind, to_email, subject, body)
  values (
    new.id,
    'revision_asignada',
    v_reviewer_email,
    'Te toca revisar: ' || new.title,
    coalesce(v_actor_name, 'Alguien') || ' te asignó revisar "' || new.title || '"' ||
      coalesce(' del proyecto ' || v_project_name, '') || '.' || chr(10) || chr(10) ||
      'Entra a la plataforma para revisarla — te aparece en tu tablero de Tareas, en "Por hacer":' ||
      chr(10) || chr(10) || 'https://sabana-de-trabajo.pages.dev/tareas'
  );

  return null;
end;
$$;

drop trigger if exists task_reviewer_notifies_email on public.tasks;
create trigger task_reviewer_notifies_email
  after insert or update of current_reviewer_person_id on public.tasks
  for each row execute function public.tg_task_reviewer_notifies_email();
