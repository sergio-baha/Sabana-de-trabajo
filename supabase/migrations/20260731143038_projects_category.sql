-- Distingue proyectos reales de bloques de tiempo institucional ("Emergentes
-- - Capacitación", "Emergentes - Feedback de gestores", etc. en el Excel de
-- origen), para poder filtrarlos aparte en Reportes sin depender de que el
-- nombre empiece con un prefijo de texto (frágil).
create type public.project_category as enum ('proyecto', 'institucional');

alter table public.projects
  add column category public.project_category not null default 'proyecto';
