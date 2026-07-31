-- comments.allocation_id referencia allocations(id): para que un Analista
-- pueda comentar una celda que nunca se guardó (0 horas, sin fila todavía),
-- necesita poder crear esa fila — pero sigue sin poder asignar horas reales.
-- Se permite el insert si el mes está bloqueado para escritura de horas
-- SOLO cuando hours = 0; cualquier valor > 0 sigue exigiendo
-- can_write_month() (gestor/admin), igual que antes.
drop policy "allocations_insert_write" on public.allocations;

create policy "allocations_insert_write" on public.allocations
  for insert to authenticated
  with check (public.can_write_month(month_id) or hours = 0);
