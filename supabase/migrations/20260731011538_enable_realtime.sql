-- Habilita Supabase Realtime (postgres_changes) para las tablas que necesitan
-- reflejar ediciones de otros usuarios en vivo mientras se ve el mismo mes:
-- la grilla (allocations) y los comentarios de celda (comments, módulo 4).
-- Sin agregarlas a esta publicación, ningún cliente recibe eventos aunque se
-- suscriba — es exactamente lo que hace el botón "Enable Realtime" del
-- dashboard de Supabase por tabla.
alter publication supabase_realtime add table public.allocations;
alter publication supabase_realtime add table public.comments;
