-- Distribución de Trabajo — esquema base
-- Tipos enumerados usados en todo el esquema. gen_random_uuid() es nativo
-- desde Postgres 13, no requiere pgcrypto en las versiones que usa Supabase.

create type public.app_role as enum ('administrador', 'gestor', 'analista');
create type public.person_status as enum ('activo', 'inactivo');
create type public.project_status as enum ('activo', 'pausado', 'finalizado', 'archivado');
create type public.month_status as enum ('abierto', 'cerrado', 'archivado');
create type public.task_status as enum ('pendiente', 'en_progreso', 'completada');
create type public.invitation_status as enum ('pendiente', 'aceptada', 'revocada');
create type public.audit_action as enum ('insert', 'update', 'delete');

-- Función utilitaria compartida: mantiene updated_at al día en cualquier
-- tabla que la use como trigger BEFORE UPDATE.
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
