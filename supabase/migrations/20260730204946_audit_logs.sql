-- audit_logs: historial genérico de cambios (módulo 9). record_id NO tiene FK
-- a propósito, para que el historial sobreviva al borrado de la fila original.
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action public.audit_action not null,
  field_name text,
  old_value text,
  new_value text,
  changed_by uuid references public.profiles (id) on delete set null,
  month_id uuid,
  changed_at timestamptz not null default now()
);

create index audit_logs_table_record_idx on public.audit_logs (table_name, record_id);
create index audit_logs_month_idx on public.audit_logs (month_id);
create index audit_logs_changed_by_idx on public.audit_logs (changed_by);
create index audit_logs_changed_at_idx on public.audit_logs (changed_at desc);

alter table public.audit_logs enable row level security;

revoke all on public.audit_logs from anon;
grant select on public.audit_logs to authenticated;

create policy "audit_logs_select_admin" on public.audit_logs
  for select to authenticated using (public.is_admin());

-- Sin políticas de insert/update/delete para authenticated: la única vía de
-- escritura es la función SECURITY DEFINER de abajo, que corre con los
-- privilegios del dueño de la tabla y por lo tanto no queda sujeta a RLS.

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_id uuid;
  v_col text;
  v_old_val text;
  v_new_val text;
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_month_id := case
      when tg_table_name = 'months' then (v_old ->> 'id')::uuid
      else nullif(v_old ->> 'month_id', '')::uuid
    end;

    insert into public.audit_logs (table_name, record_id, action, changed_by, month_id, old_value)
    values (tg_table_name, old.id, 'delete', auth.uid(), v_month_id, v_old::text);
    return old;

  elsif tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_month_id := case
      when tg_table_name = 'months' then new.id
      else nullif(v_new ->> 'month_id', '')::uuid
    end;

    insert into public.audit_logs (table_name, record_id, action, changed_by, month_id, new_value)
    values (tg_table_name, new.id, 'insert', auth.uid(), v_month_id, v_new::text);
    return new;

  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_month_id := case
      when tg_table_name = 'months' then new.id
      else coalesce(nullif(v_new ->> 'month_id', '')::uuid, nullif(v_old ->> 'month_id', '')::uuid)
    end;

    for v_col in select jsonb_object_keys(v_new)
    loop
      if v_col in ('updated_at', 'created_at') then
        continue;
      end if;

      v_old_val := v_old ->> v_col;
      v_new_val := v_new ->> v_col;

      if v_old_val is distinct from v_new_val then
        insert into public.audit_logs
          (table_name, record_id, action, field_name, old_value, new_value, changed_by, month_id)
        values
          (tg_table_name, new.id, 'update', v_col, v_old_val, v_new_val, auth.uid(), v_month_id);
      end if;
    end loop;
    return new;
  end if;
end;
$$;

create trigger audit_months
  after insert or update or delete on public.months
  for each row execute function public.audit_row_change();

create trigger audit_people
  after insert or update or delete on public.people
  for each row execute function public.audit_row_change();

create trigger audit_projects
  after insert or update or delete on public.projects
  for each row execute function public.audit_row_change();

create trigger audit_project_managers
  after insert or update or delete on public.project_managers
  for each row execute function public.audit_row_change();

create trigger audit_tasks
  after insert or update or delete on public.tasks
  for each row execute function public.audit_row_change();

create trigger audit_allocations
  after insert or update or delete on public.allocations
  for each row execute function public.audit_row_change();
