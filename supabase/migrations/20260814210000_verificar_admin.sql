-- Verificación del traslado de administrador. No cambia nada: reporta cómo
-- quedaron las cuentas y confirma que la nueva tiene todo lo que el login por
-- contraseña necesita (identidad, correo confirmado, hash guardado).
do $$
declare
  d record;
begin
  for d in
    select p.email, p.role, p.is_active,
           u.email_confirmed_at is not null as correo_confirmado,
           u.encrypted_password is not null as tiene_clave,
           exists (
             select 1 from auth.identities i
             where i.user_id = u.id and i.provider = 'email'
           ) as tiene_identidad
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.email in ('admin@ceinfes.com', 'sergio.bahamon@ceinfes.com')
    order by p.email
  loop
    raise notice '% → rol %, activo %, correo confirmado %, clave %, identidad %',
      d.email, d.role, d.is_active, d.correo_confirmado, d.tiene_clave, d.tiene_identidad;
  end loop;

  for d in
    select email from public.profiles where role = 'administrador' and is_active order by email
  loop
    raise notice 'Administrador activo: %', d.email;
  end loop;
end;
$$;
