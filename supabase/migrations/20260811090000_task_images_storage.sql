-- Bucket para las imágenes que se insertan en la descripción (rich text) de
-- las tarjetas. Público en lectura porque la descripción se renderiza como
-- HTML con <img src="...">: si el bucket no fuera público, cada imagen
-- necesitaría una URL firmada individual, lo que complica el editor sin
-- aportar nada (el contenido ya vive detrás del login de la app).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-images',
  'task-images',
  true,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
on conflict (id) do nothing;

-- Cualquier usuario autenticado puede subir imágenes a sus tarjetas: no hay
-- noción de "dueño" del archivo en sí, la pertenencia real vive en la fila
-- de `tasks` que referencia la URL, ya protegida por sus propias políticas.
create policy "task_images_insert_authenticated" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'task-images');

create policy "task_images_delete_authenticated" on storage.objects
  for delete to authenticated
  using (bucket_id = 'task-images');

-- Lectura pública (además del acceso vía RLS de authenticated) para que la
-- URL pública que genera el cliente de Storage sirva directo en el <img>.
create policy "task_images_select_public" on storage.objects
  for select to public
  using (bucket_id = 'task-images');
