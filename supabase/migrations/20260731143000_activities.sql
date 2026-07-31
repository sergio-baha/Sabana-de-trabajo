-- activities: desglose opcional de una celda de la grilla (allocation) en
-- tareas concretas — descripción, fase de metodología de innovación y
-- fecha. Cuando una celda tiene actividades, sus horas dejan de ser un
-- número suelto y pasan a ser la suma de sus actividades (trigger
-- sync_allocation_hours_from_activities); una celda sin actividades sigue
-- editándose a mano como hasta ahora. Es el mismo patrón que comments:
-- ligado a allocation_id, mismo dueño de permisos que la celda.
create type public.activity_phase as enum (
  'descubrir', 'definir', 'desarrollar', 'producto', 'entregar'
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.allocations (id) on delete cascade,
  month_id uuid not null references public.months (id) on delete cascade,
  description text not null check (char_length(btrim(description)) > 0),
  phase public.activity_phase,
  activity_date date,
  hours numeric(6, 2) not null default 0 check (hours >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index activities_allocation_idx on public.activities (allocation_id);
create index activities_month_idx on public.activities (month_id);

create trigger set_updated_at
  before update on public.activities
  for each row execute function public.tg_set_updated_at();

alter table public.activities enable row level security;

revoke all on public.activities from anon;
grant select, insert, update, delete on public.activities to authenticated;

-- Mismas reglas de escritura que la celda que desglosan: si no puede editar
-- horas en este mes (Analista, o Gestor con el mes cerrado/archivado),
-- tampoco puede agregar/editar/borrar actividades.
create policy "activities_select_authenticated" on public.activities
  for select to authenticated using (true);

create policy "activities_insert_write" on public.activities
  for insert to authenticated with check (public.can_write_month(month_id));

create policy "activities_update_write" on public.activities
  for update to authenticated
  using (public.can_write_month(month_id))
  with check (public.can_write_month(month_id));

create policy "activities_delete_write" on public.activities
  for delete to authenticated using (public.can_write_month(month_id));

-- Mantiene allocations.hours = suma de sus actividades. Se dispara con
-- cualquier insert/update/delete de actividades; si la celda se queda sin
-- actividades, el total baja a 0 (vuelve a quedar editable a mano desde 0).
create or replace function public.sync_allocation_hours_from_activities()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allocation_id uuid;
begin
  v_allocation_id := coalesce(new.allocation_id, old.allocation_id);

  update public.allocations
  set hours = coalesce(
    (select sum(a.hours) from public.activities a where a.allocation_id = v_allocation_id),
    0
  )
  where id = v_allocation_id;

  return coalesce(new, old);
end;
$$;

create trigger sync_allocation_hours
  after insert or update or delete on public.activities
  for each row execute function public.sync_allocation_hours_from_activities();
