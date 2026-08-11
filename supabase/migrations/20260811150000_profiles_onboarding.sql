-- Marca de que la cuenta ya vio el recorrido de bienvenida. Va en profiles
-- y no en localStorage para que siga a la persona entre navegadores y
-- equipos: alguien que ya conoce la herramienta no debería volver a ver el
-- tour por entrar desde otro computador.
--
-- `null` = nunca lo ha visto, y es justo lo que dispara el recorrido la
-- primera vez. Se guarda la fecha y no un booleano porque además responde
-- "desde cuándo esta persona está usando la plataforma", que es dato útil
-- y no cuesta nada conservar.
alter table public.profiles
  add column onboarded_at timestamptz;

-- No hace falta política nueva: `profiles_update_self_or_admin` ya permite
-- que cada quien actualice su propia fila, y el trigger
-- guard_profile_privileged_columns solo blinda `role` e `is_active`, así
-- que esta columna queda editable por su dueño — que es lo que se busca.
