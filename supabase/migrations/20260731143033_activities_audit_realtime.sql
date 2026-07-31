-- Auditoría genérica también sobre activities (igual que people/projects/
-- allocations/months/project_managers/tasks, ver *_audit_logs.sql).
create trigger audit_activities
  after insert or update or delete on public.activities
  for each row execute function public.audit_row_change();

-- Realtime para que el desglose de actividades se vea en vivo entre
-- usuarios, igual que allocations/comments (ver *_enable_realtime.sql).
alter publication supabase_realtime add table public.activities;
