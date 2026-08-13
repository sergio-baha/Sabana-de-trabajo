-- Traslado de la cuenta de administrador principal.
--
-- Antes el administrador era la cuenta personal de una persona
-- (sergio.bahamon@ceinfes.com), que además es quien trabaja en el equipo. Se
-- separan los dos papeles: queda una cuenta institucional para administrar
-- (admin@ceinfes.com) y la personal pasa a Analista, que es lo que esa
-- persona hace todos los días.
--
-- La cuenta se crea escribiendo en `auth.users` porque es el único canal
-- disponible desde una migración; el flujo normal (invitación → Edge
-- Function) necesita la clave de servicio. Se replica lo que hace GoTrue al
-- registrar por correo:
--   · `email_confirmed_at` puesto, para que no quede esperando confirmación;
--   · fila en `auth.identities` con provider 'email', sin la cual el login
--     por contraseña no encuentra la identidad;
--   · `raw_app_meta_data` con el provider, que es lo que lee el token.
-- El perfil de la aplicación lo crea solo el trigger `on_auth_user_created`
-- (con rol 'analista'), y acá se sube a 'administrador'.
--
-- La contraseña queda hasheada con bcrypt, pero el texto plano vive en este
-- archivo y por lo tanto en el repositorio: es una credencial de arranque,
-- pensada para cambiarse en el primer ingreso.

-- pgcrypto vive en el esquema `extensions` en Supabase, no en `public`: hay
-- que llamar a crypt/gen_salt calificados.
do $$
declare
  v_admin_id uuid;
begin
  select id into v_admin_id from auth.users where email = 'admin@ceinfes.com';

  if v_admin_id is null then
    v_admin_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      v_admin_id,
      'authenticated',
      'authenticated',
      'admin@ceinfes.com',
      extensions.crypt('Admin123', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Administrador"}'::jsonb,
      now(),
      now()
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at,
      created_at, updated_at
    )
    values (
      gen_random_uuid(),
      v_admin_id,
      v_admin_id::text,
      jsonb_build_object('sub', v_admin_id::text, 'email', 'admin@ceinfes.com',
                         'email_verified', true, 'phone_verified', false),
      'email',
      now(),
      now(),
      now()
    );

    raise notice 'Cuenta admin@ceinfes.com creada';
  else
    -- Si ya existía, se le fija la contraseña acordada y se confirma.
    update auth.users
    set encrypted_password = extensions.crypt('Admin123', extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = v_admin_id;

    raise notice 'Cuenta admin@ceinfes.com ya existía: contraseña actualizada';
  end if;

  -- El perfil lo creó el trigger como 'analista'.
  update public.profiles
  set role = 'administrador',
      full_name = 'Administrador',
      is_active = true
  where id = v_admin_id;

  -- La cuenta personal baja a Analista. Se hace DESPUÉS de dejar lista la
  -- institucional: al revés, el espacio quedaría un instante sin ningún
  -- administrador.
  update public.profiles
  set role = 'analista'
  where email = 'sergio.bahamon@ceinfes.com';

  raise notice 'Administradores activos: %',
    (select count(*) from public.profiles where role = 'administrador' and is_active);
end;
$$;
