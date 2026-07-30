-- month_snapshots: checkpoints jsonb restaurables de un mes (módulo
-- "historial de versiones por mes"), distinto del audit_logs campo a campo.
-- Escritura solo vía RPC (0016), igual que audit_logs.
create table public.month_snapshots (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references public.months (id) on delete cascade,
  label text,
  snapshot jsonb not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index month_snapshots_month_idx on public.month_snapshots (month_id);

alter table public.month_snapshots enable row level security;

revoke all on public.month_snapshots from anon;
grant select, delete on public.month_snapshots to authenticated;

create policy "month_snapshots_select_gestor_admin" on public.month_snapshots
  for select to authenticated using (public.is_gestor_or_admin());

create policy "month_snapshots_delete_admin" on public.month_snapshots
  for delete to authenticated using (public.is_admin());
