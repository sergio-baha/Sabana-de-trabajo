-- comments: los analistas solo pueden comentar (nunca editar horas); ver
-- políticas de allocations en 0008, que no les dan permiso de escritura.
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.allocations (id) on delete cascade,
  parent_comment_id uuid references public.comments (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) > 0),
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comments_allocation_idx on public.comments (allocation_id);
create index comments_parent_idx on public.comments (parent_comment_id);

create trigger set_updated_at
  before update on public.comments
  for each row execute function public.tg_set_updated_at();

alter table public.comments enable row level security;

revoke all on public.comments from anon;
grant select, insert, update, delete on public.comments to authenticated;

create policy "comments_select_authenticated" on public.comments
  for select to authenticated using (true);

create policy "comments_insert_authenticated" on public.comments
  for insert to authenticated with check (author_id = auth.uid());

create policy "comments_update_author_or_admin" on public.comments
  for update to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

create policy "comments_delete_author_or_admin" on public.comments
  for delete to authenticated using (author_id = auth.uid() or public.is_admin());
