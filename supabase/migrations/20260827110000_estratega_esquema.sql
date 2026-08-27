-- Gobernanza · esquema del rol Estratega.
--
-- Reemplaza dos artefactos sueltos que hoy viven fuera de la plataforma:
--   · SEGUIMIENTO_A_GESTORES_2026.xlsx (una hoja por mes + hoja PIPELINE),
--   · dashboard_ceinfes_2026.html, que lee ese Excel vía Power Automate y
--     trae los datos incrustados en tres arreglos de JavaScript.
--
-- ─────────────────────────────────────────────────────────────────────────
-- POR QUÉ TABLAS PROPIAS Y NO LAS DE LA SÁBANA
-- La app ya modela meses, personas, proyectos y presupuesto, así que la
-- tentación es derivar todo de ahí. No se puede: el presupuesto de la sábana
-- es POR PROYECTO y el del Estratega es POR GESTOR; y los "entregables
-- pipeline" son compromisos de gestión que nunca fueron tarjetas del tablero.
-- Derivarlos exigiría inventar el dato. Son tablas aparte, con su propio
-- ciclo de vida, y se cruzan con el resto por `profile_id`.
--
-- POR QUÉ `estratega_entregables` Y NO `estratega_tareas`
-- En esta app "tarea" es una tarjeta del tablero (`public.tasks`), con
-- estado, responsable, revisión e historial. Estos son otra cosa: la columna
-- "Entregables pipeline" del Excel. Llamarlos tareas habría hecho ambiguo
-- cada nombre de función y cada consulta.
--
-- POR QUÉ NO HAY CONTADORES `*_hecho` / `*_total`
-- El dashboard original guarda el avance dos veces: como contadores en el
-- producto y como checklist marcable en el drawer, y los sincroniza a mano
-- en JS. Dos verdades para el mismo hecho es de donde salen los tableros que
-- no cuadran. Aquí manda el checklist (`estratega_producto_items`) y el
-- avance se cuenta al leer — son ~14 filas por producto, no hay nada que
-- optimizar. Por eso tampoco existe la función de recálculo del documento.
-- ─────────────────────────────────────────────────────────────────────────

-- ---------------------------------------------------------------------------
-- 1. Predicados del rol
-- ---------------------------------------------------------------------------
-- Mismo molde que `is_admin()` / `is_coordinador()`: función security definer
-- que lee `profiles`, porque el rol NO viaja en el JWT. (El documento de
-- especificación proponía `auth.jwt() ->> 'role'`; aquí eso siempre da null.)
create or replace function public.is_estratega()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'estratega' and is_active
  );
$$;

revoke all on function public.is_estratega() from public;
grant execute on function public.is_estratega() to authenticated;

-- Quién entra a Gobernanza. El Administrador siempre: es el patrón que ya
-- siguen los tickets, y evita que la única persona con acceso a un módulo
-- entero sea quien tenga el rol nuevo (si se va, nadie puede ni corregir un
-- dato). Espejo de `GOBERNANZA_ROLES` en el frontend.
create or replace function public.sees_gobernanza()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('estratega', 'administrador')
      and is_active
  );
$$;

revoke all on function public.sees_gobernanza() from public;
grant execute on function public.sees_gobernanza() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Dominios
-- ---------------------------------------------------------------------------
-- Las tres células de producto de CEINFES.
create type public.estratega_celula as enum (
  'evaluacion',
  'gestion_academica',
  'sostenibilidad'
);

-- Estados reales de la columna E del Excel. `aplazado` es el que faltaba: en
-- la hoja aparece escrito como el nombre del mes al que se corrió el
-- compromiso ("JUNIO" en la fila de mayo de Katherine Bustos). El dashboard
-- original ni siquiera lo pinta — declara su color y enseguida redeclara el
-- mapa sin él, así que cae al gris de "otro".
--
-- Se admite NULL para "sin estado": las tres filas de Claudia Gacharná de
-- abril llegan en blanco porque su acompañamiento arrancó ese mes. NULL y no
-- cadena vacía — tener las dos formas de "vacío" en la misma columna termina
-- en un `group by` con dos categorías invisibles distintas.
create type public.estratega_entrega_estado as enum (
  'entregado',
  'en_proceso',
  'no_entregado',
  'detenido',
  'aplazado'
);

-- Las cuatro fases del Doble Diamante. El orden del enum es el orden de la
-- metodología, y de él dependen los acordeones del detalle de producto.
create type public.estratega_fase as enum (
  'descubrir',
  'definir',
  'desarrollar',
  'entregar'
);

-- ---------------------------------------------------------------------------
-- 3. Ejecución financiera por gestor y mes
-- ---------------------------------------------------------------------------
-- `anio` + `mes` numéricos en vez del nombre del mes en texto: ordenan solos
-- y no obligan a arrastrar el arreglo ORDEN_MESES que el dashboard original
-- necesitaba para poder listar los períodos en orden. La etiqueta ("Marzo
-- 2026") la arma el frontend.
--
-- NO se referencia `public.months`: aquel es el mes de PLANEACIÓN de la
-- sábana, que puede no existir para un período que el Estratega sí necesita
-- reportar. Son dos calendarios distintos que por ahora coinciden.
create table public.estratega_finanzas (
  id uuid primary key default gen_random_uuid(),
  anio smallint not null check (anio between 2000 and 2100),
  mes smallint not null check (mes between 1 and 12),
  -- El nombre tal como viene del Excel. Es la llave de importación y lo que
  -- se muestra si la persona no tiene cuenta.
  colaborador text not null check (length(btrim(colaborador)) > 0),
  -- Los gestores SÍ son cuentas de la plataforma, así que se vinculan. Queda
  -- nullable a propósito: la carga no puede fallar porque alguien todavía no
  -- tenga usuario. `on delete set null` conserva el histórico financiero
  -- aunque se borre la cuenta — el dato del mes cerrado no desaparece.
  profile_id uuid references public.profiles (id) on delete set null,
  presupuestado numeric(14, 2) not null default 0 check (presupuestado >= 0),
  ejecutado numeric(14, 2) not null default 0 check (ejecutado >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un gestor tiene UNA fila por mes. Sin esto, importar dos veces el mismo
  -- Excel duplica el presupuesto del período y el % de ejecución se parte a
  -- la mitad sin que nadie lo note.
  unique (anio, mes, colaborador)
);

create index estratega_finanzas_periodo_idx on public.estratega_finanzas (anio, mes);
create index estratega_finanzas_profile_idx on public.estratega_finanzas (profile_id);

-- ---------------------------------------------------------------------------
-- 4. Entregables pipeline por gestor y mes
-- ---------------------------------------------------------------------------
create table public.estratega_entregables (
  id uuid primary key default gen_random_uuid(),
  anio smallint not null check (anio between 2000 and 2100),
  mes smallint not null check (mes between 1 and 12),
  colaborador text not null check (length(btrim(colaborador)) > 0),
  profile_id uuid references public.profiles (id) on delete set null,
  descripcion text not null check (length(btrim(descripcion)) > 0),
  -- NULL = sin estado todavía (ver el comentario del enum).
  estado public.estratega_entrega_estado,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index estratega_entregables_periodo_idx on public.estratega_entregables (anio, mes);
create index estratega_entregables_estado_idx on public.estratega_entregables (estado);
create index estratega_entregables_profile_idx on public.estratega_entregables (profile_id);

-- Sin UNIQUE aquí, a diferencia de finanzas: un mismo compromiso se arrastra
-- de un mes al siguiente cuando no se cumple, y eso es información, no
-- duplicado. La deduplicación al importar la decide quien importa.

-- ---------------------------------------------------------------------------
-- 5. Pipeline comercial (Doble Diamante)
-- ---------------------------------------------------------------------------
create table public.estratega_productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) > 0),
  celula public.estratega_celula not null,
  -- Fecha comprometida de salida al mercado. Es la que dispara el semáforo
  -- de SLA: vencida, ≤30 días, o en fecha.
  fecha_limite date not null,
  notas text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index estratega_productos_celula_idx on public.estratega_productos (celula);
create index estratega_productos_fecha_idx on public.estratega_productos (fecha_limite);

-- El checklist: la unidad real de avance. Marcar un ítem aquí es lo único
-- que mueve el porcentaje de una fase, de un producto y del portafolio.
create table public.estratega_producto_items (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.estratega_productos (id) on delete cascade,
  fase public.estratega_fase not null,
  titulo text not null check (length(btrim(titulo)) > 0),
  orden smallint not null default 0,
  completado boolean not null default false,
  -- Cuándo y quién. Los mantiene el trigger de abajo, no el frontend: si
  -- dependiera del cliente, bastaría un `update` desde otro lado para dejar
  -- un ítem marcado sin autor ni fecha.
  completado_en timestamptz,
  completado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index estratega_producto_items_producto_idx
  on public.estratega_producto_items (producto_id, fase, orden);

create or replace function public.tg_estratega_item_completado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.completado is distinct from coalesce(old.completado, false) then
    if new.completado then
      new.completado_en := now();
      new.completado_por := auth.uid();
    else
      -- Al desmarcar se limpia la firma: dejar el autor anterior haría creer
      -- que esa persona certificó algo que hoy está pendiente.
      new.completado_en := null;
      new.completado_por := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger estratega_item_completado
  before insert or update on public.estratega_producto_items
  for each row execute function public.tg_estratega_item_completado();

-- ---------------------------------------------------------------------------
-- 6. `updated_at` y auditoría
-- ---------------------------------------------------------------------------
create trigger set_updated_at
  before update on public.estratega_finanzas
  for each row execute function public.tg_set_updated_at();

create trigger set_updated_at
  before update on public.estratega_entregables
  for each row execute function public.tg_set_updated_at();

create trigger set_updated_at
  before update on public.estratega_productos
  for each row execute function public.tg_set_updated_at();

create trigger set_updated_at
  before update on public.estratega_producto_items
  for each row execute function public.tg_set_updated_at();

-- Las cuatro entran al Historial de la app. Es dato de gobernanza que se
-- edita a mano y que alguien va a querer reconstruir: quién bajó el
-- presupuesto de un mes cerrado, quién desmarcó un entregable certificado.
create trigger audit_estratega_finanzas
  after insert or update or delete on public.estratega_finanzas
  for each row execute function public.audit_row_change();

create trigger audit_estratega_entregables
  after insert or update or delete on public.estratega_entregables
  for each row execute function public.audit_row_change();

create trigger audit_estratega_productos
  after insert or update or delete on public.estratega_productos
  for each row execute function public.audit_row_change();

create trigger audit_estratega_producto_items
  after insert or update or delete on public.estratega_producto_items
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------------
-- Todo el módulo es "ve quien gobierna": no hay recorte por fila. A
-- diferencia de las tareas —donde cada quien ve lo suyo—, un tablero de
-- gobernanza que mostrara solo una parte del portafolio no serviría para
-- nada. El recorte es de MÓDULO, y por eso vive en el rol.
alter table public.estratega_finanzas enable row level security;
alter table public.estratega_entregables enable row level security;
alter table public.estratega_productos enable row level security;
alter table public.estratega_producto_items enable row level security;

revoke all on public.estratega_finanzas from anon;
revoke all on public.estratega_entregables from anon;
revoke all on public.estratega_productos from anon;
revoke all on public.estratega_producto_items from anon;

grant select, insert, update, delete on public.estratega_finanzas to authenticated;
grant select, insert, update, delete on public.estratega_entregables to authenticated;
grant select, insert, update, delete on public.estratega_productos to authenticated;
grant select, insert, update, delete on public.estratega_producto_items to authenticated;

create policy estratega_finanzas_select on public.estratega_finanzas
  for select using (public.sees_gobernanza());
create policy estratega_finanzas_write on public.estratega_finanzas
  for all using (public.sees_gobernanza()) with check (public.sees_gobernanza());

create policy estratega_entregables_select on public.estratega_entregables
  for select using (public.sees_gobernanza());
create policy estratega_entregables_write on public.estratega_entregables
  for all using (public.sees_gobernanza()) with check (public.sees_gobernanza());

create policy estratega_productos_select on public.estratega_productos
  for select using (public.sees_gobernanza());
create policy estratega_productos_write on public.estratega_productos
  for all using (public.sees_gobernanza()) with check (public.sees_gobernanza());

create policy estratega_producto_items_select on public.estratega_producto_items
  for select using (public.sees_gobernanza());
create policy estratega_producto_items_write on public.estratega_producto_items
  for all using (public.sees_gobernanza()) with check (public.sees_gobernanza());
