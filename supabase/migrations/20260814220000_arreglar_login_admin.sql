-- Arregla el login de admin@ceinfes.com.
--
-- La cuenta se creó a mano en `auth.users` (ver *_admin_principal.sql) y las
-- columnas de token quedaron en NULL. GoTrue las lee como `string` de Go, no
-- como puntero: una NULL revienta el escaneo de la fila y la respuesta es un
-- 500 sin cuerpo — que en el cliente se ve como el error vacío "{}" del
-- toast, sin ninguna pista.
--
-- El registro normal las deja en cadena vacía, así que eso es lo que se
-- repone. Se aplica a cualquier fila con NULL en esas columnas, no solo a la
-- del admin: si alguna otra cuenta quedó igual, tiene el mismo problema
-- latente.
update auth.users
set confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change = coalesce(email_change, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    phone_change = coalesce(phone_change, ''),
    phone_change_token = coalesce(phone_change_token, ''),
    reauthentication_token = coalesce(reauthentication_token, '')
where confirmation_token is null
   or recovery_token is null
   or email_change is null
   or email_change_token_new is null
   or email_change_token_current is null
   or phone_change is null
   or phone_change_token is null
   or reauthentication_token is null;

do $$
declare
  v_pendientes integer;
begin
  select count(*) into v_pendientes
  from auth.users
  where confirmation_token is null or recovery_token is null;

  raise notice 'Filas de auth.users con tokens en NULL tras el arreglo: %', v_pendientes;
end;
$$;
