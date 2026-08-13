-- Gestión de cuentas desde la app: cambiar el correo de acceso y reiniciar la
-- contraseña de otra persona.
--
-- El nombre y el cargo ya se editan directo sobre `profiles` (RLS deja al
-- administrador escribir cualquier perfil). El correo y la contraseña, no:
-- viven en `auth.users`, que el cliente no puede tocar ni con RLS — hace
-- falta la clave de servicio, que el navegador nunca debe tener.
--
-- Se resuelve con dos RPC SECURITY DEFINER que comprueban `is_admin()` antes
-- de nada. La alternativa era un Edge Function como `invite-user`, y sería
-- más ortodoxo (GoTrue aplicaría sus propias políticas de contraseña y el
-- flujo de confirmación de correo); se descartó porque desplegar funciones
-- exige un token de la API de gestión que este entorno no tiene, y una
-- función que no se puede desplegar no sirve de nada.
--
-- Consecuencias de escribir `auth.users` a mano, asumidas a conciencia:
--   · El cambio de correo es inmediato y sin confirmación por correo. Es lo
--     que se quiere: lo hace un administrador, no el dueño de la cuenta.
--   · Al reiniciar la contraseña se cierran las sesiones abiertas de esa
--     persona; si no, seguiría dentro con la clave vieja.

-- ---------------------------------------------------------------------------
-- Cambiar el correo de acceso
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_user_email(p_user_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(p_email));
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar el correo de una cuenta';
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'El correo no tiene un formato válido';
  end if;

  if exists (select 1 from auth.users where lower(email) = v_email and id <> p_user_id) then
    raise exception 'Ya hay una cuenta con ese correo';
  end if;

  update auth.users
  set email = v_email,
      -- Lo cambia un administrador: se da por confirmado, si no la cuenta
      -- quedaría esperando un correo de verificación que nadie pidió.
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'La cuenta no existe';
  end if;

  -- La identidad del proveedor 'email' guarda su propia copia; si no se
  -- actualiza, el login sigue resolviendo contra el correo viejo.
  update auth.identities
  set identity_data = identity_data || jsonb_build_object('email', v_email),
      updated_at = now()
  where user_id = p_user_id and provider = 'email';

  -- `profiles.email` es la copia que muestra la aplicación.
  update public.profiles set email = v_email where id = p_user_id;
end;
$$;

revoke all on function public.admin_update_user_email(uuid, text) from public;
grant execute on function public.admin_update_user_email(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Reiniciar la contraseña
-- ---------------------------------------------------------------------------
create or replace function public.admin_reset_user_password(p_user_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede reiniciar una contraseña';
  end if;

  if p_password is null or length(p_password) < 8 then
    raise exception 'La contraseña debe tener al menos 8 caracteres';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
      -- Las columnas de token no admiten NULL para GoTrue (lee strings de
      -- Go): se reponen por si la fila viene de una carga manual.
      confirmation_token = coalesce(confirmation_token, ''),
      recovery_token = coalesce(recovery_token, ''),
      email_change = coalesce(email_change, ''),
      email_change_token_new = coalesce(email_change_token_new, ''),
      email_change_token_current = coalesce(email_change_token_current, ''),
      updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'La cuenta no existe';
  end if;

  -- Fuera las sesiones abiertas: reiniciar la clave y dejar a la persona
  -- dentro con la sesión vieja sería no haberla reiniciado.
  delete from auth.sessions where user_id = p_user_id;
  delete from auth.refresh_tokens where user_id::uuid = p_user_id;
end;
$$;

revoke all on function public.admin_reset_user_password(uuid, text) from public;
grant execute on function public.admin_reset_user_password(uuid, text) to authenticated;
