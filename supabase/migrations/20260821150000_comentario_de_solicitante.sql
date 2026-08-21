-- Un comentario puede venir de fuera de la plataforma.
--
-- `task_comments.author_id` era NOT NULL contra `profiles`, y con razón: hasta
-- ahora todo comentario lo escribía alguien con cuenta, dentro de la app.
--
-- La mesa de ayuda rompe ese supuesto. Cuando el solicitante responde al
-- correo del ticket, su respuesta entra como comentario — y el solicitante es
-- cualquier persona del dominio, que puede no tener cuenta en la plataforma.
-- No la necesita: escribió un correo, no abrió la aplicación.
--
-- `author_id` nulo pasa a significar "vino de fuera, por correo". Quién fue en
-- concreto está en `tasks.requester_email` y en el propio texto del comentario,
-- que la Edge Function encabeza con la dirección.
--
-- LA ALTERNATIVA QUE SE DESCARTÓ: crear un perfil fantasma por cada
-- solicitante para poder seguir exigiendo la FK. Habría llenado `profiles` —
-- que es la tabla de CUENTAS, la que gobierna roles y permisos— de filas que
-- no son cuentas de nadie, y cada listado de usuarios habría tenido que
-- aprender a esconderlas. Un nulo con un significado claro cuesta menos que
-- una tabla de identidades contaminada.
alter table public.task_comments
  alter column author_id drop not null;

-- El insert desde la app sigue exigiendo autor: el nulo es SOLO para lo que
-- entra por el proceso automático (service role, que no pasa por RLS). Sin
-- esto, un cliente podría escribir comentarios anónimos dentro de la
-- plataforma, que es justo lo que no se quiere.
drop policy if exists "task_comments_insert_own" on public.task_comments;

create policy "task_comments_insert_own" on public.task_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.tasks t where t.id = task_comments.task_id)
  );
