-- invitations: registro de invitaciones enviadas por un administrador. La
-- creación real de la cuenta (auth.users) la hace el Edge Function
-- invite-user con service_role, no un insert directo del cliente.
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role public.app_role not null default 'analista',
  status public.invitation_status not null default 'pendiente',
  invited_by uuid references public.profiles (id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz
);

create unique index invitations_pending_email_idx
  on public.invitations (lower(email))
  where status = 'pendiente';

alter table public.invitations enable row level security;

revoke all on public.invitations from anon;
grant select, insert, update, delete on public.invitations to authenticated;

create policy "invitations_select_admin" on public.invitations
  for select to authenticated using (public.is_admin());

create policy "invitations_insert_admin" on public.invitations
  for insert to authenticated with check (public.is_admin());

create policy "invitations_update_admin" on public.invitations
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "invitations_delete_admin" on public.invitations
  for delete to authenticated using (public.is_admin());
