# Guía de instalación

## 1. Requisitos

- Node.js 20+
- Una cuenta de [Supabase](https://supabase.com) (plan gratuito alcanza para empezar)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm i -g supabase` o `scoop install supabase`)
- Una cuenta de [Cloudflare](https://dash.cloudflare.com) para el despliegue del frontend

Este proyecto **no requiere Docker**: el flujo de trabajo es Supabase
hosteado (no una instancia local emulada) + Cloudflare Pages, igual que el
resto de proyectos de este equipo.

## 2. Crear el proyecto Supabase

1. En el [dashboard de Supabase](https://supabase.com/dashboard), crea un proyecto nuevo.
2. Anota la **Project URL** y la **anon public key** (Project Settings → API) — van en `.env`.
3. Vincula el CLI local a tu proyecto:

   ```bash
   supabase login
   supabase link --project-ref <tu-project-ref>
   ```

## 3. Aplicar las migraciones

Todas las tablas, políticas RLS, triggers, vistas y funciones viven en
`supabase/migrations/`, en orden. Aplícalas con:

```bash
supabase db push
```

Alternativa manual: pega el contenido de cada archivo de
`supabase/migrations/` (en orden por nombre) en el SQL Editor del dashboard
de Supabase y ejecútalos uno por uno.

> Estas migraciones se escribieron y revisaron a mano; no fue posible
> correr `supabase start` (Docker) en el entorno donde se generó este
> proyecto. Ejecuta `supabase db push` contra un proyecto de prueba antes de
> producción y revisa que no haya errores.

## 4. Bootstrap del primer administrador

El trigger `handle_new_user` siempre crea perfiles nuevos con rol
`analista` (por diseño: nunca confía en el rol que venga en el payload de
registro, para que nadie pueda auto-asignarse `administrador`). Por lo
tanto, el primer administrador se promueve manualmente:

1. Crea tu primera cuenta desde `/login` → "¿Olvidaste tu contraseña?" no
   sirve para esto — en su lugar, habilita temporalmente el registro por
   correo en **Authentication → Providers → Email** del dashboard, o crea el
   usuario directamente desde **Authentication → Users → Add user**.
2. En el **SQL Editor**, ejecuta (reemplazando el correo):

   ```sql
   update public.profiles
   set role = 'administrador'
   where email = 'tu-correo@empresa.com';
   ```

3. Deshabilita de nuevo el registro público por correo en Authentication →
   Providers, si lo habilitaste en el paso 1 — a partir de aquí, los
   usuarios nuevos deben crearse **solo** vía Configuración → Invitaciones
   (que usa el Edge Function `invite-user`, no el registro público).

## 5. Desplegar el Edge Function `invite-user`

Necesario para que Configuración → Invitaciones pueda crear cuentas nuevas.

```bash
supabase functions deploy invite-user
```

El Edge Function usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
`SUPABASE_SERVICE_ROLE_KEY` — Supabase las provee automáticamente a las
funciones desplegadas, no hace falta configurarlas a mano en producción.

Para probarlo en desarrollo local con `supabase functions serve`, crea
`supabase/functions/.env` (gitignored) con esas tres variables tomadas de
Project Settings → API.

## 6. Variables de entorno del frontend

```bash
cp .env.example .env
```

Completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los valores de
tu proyecto (Project Settings → API). Nunca uses la `service_role` key en
el frontend.

## 7. Correr en desarrollo

```bash
npm install
npm run dev
```

## 8. Desplegar en Cloudflare Pages

1. Sube el repositorio a GitHub.
2. En Cloudflare Pages, "Create a project" → conecta el repositorio.
3. Configuración de build:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Variables de entorno del build (Settings → Environment variables):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Despliega. El SPA routing (servir `index.html` en cualquier ruta que no
   sea un archivo estático, para que recargar `/dashboard` no dé 404) queda
   configurado por `wrangler.jsonc` (`assets.not_found_handling:
   "single-page-application"`) — **no** uses un `public/_redirects` con
   `/* /index.html 200`: Cloudflare lo rechaza como falso positivo de
   "infinite loop" en su validador actual (ver
   [cloudflare/workers-sdk#11824](https://github.com/cloudflare/workers-sdk/issues/11824)).
   `public/_headers` sigue aplicando cabeceras de seguridad (CSP,
   X-Frame-Options, etc.) con normalidad — revisa el `connect-src` ahí si tu
   proyecto Supabase usa un dominio distinto a `*.supabase.co`.

## 9. Después del primer despliegue

- Crea los meses, personas y proyectos iniciales desde la app (o duplica un
  mes de prueba con datos).
- Invita al resto del equipo desde Configuración → Invitaciones — cada
  invitación envía un correo de Supabase con un enlace para fijar
  contraseña.
- Considera restringir el CORS del Edge Function `invite-user` (hoy usa
  `Access-Control-Allow-Origin: *`) al dominio final de Cloudflare Pages
  una vez lo conozcas — no es una vulnerabilidad (la función valida el rol
  del llamante con su JWT sin importar el origen), pero es una capa extra
  razonable antes de producción.
