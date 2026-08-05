# Distribución de Trabajo

Plataforma para administrar la asignación mensual de horas de cada colaborador
entre proyectos: vista tipo Excel con autoguardado, control de acceso por
rol, auditoría completa, reportes exportables y duplicación de meses.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| UI | TailwindCSS v4 + shadcn/ui (Radix) |
| Grilla | react-data-grid |
| Estado servidor | TanStack Query |
| Estado UI | Zustand |
| Gráficos | Recharts |
| Exportar | write-excel-file (Excel), @react-pdf/renderer (PDF) |
| Backend | Supabase (Postgres, Auth, RLS, Realtime, Edge Functions) |
| Hosting | Cloudflare Pages |

## Módulos

1. **Dashboard** — mes activo, totales, sobreasignaciones, últimos cambios.
2. **Distribución de trabajo** — grilla personas × proyectos, autoguardado, verde/amarillo/rojo.
3. **Tareas** — tablero kanban y backlog de work items (tipo, prioridad, jerarquía, etiquetas), estilo Azure DevOps Boards.
4. **Cronograma** — Gantt de tareas y calendario de horas por día, por persona.
5. **Gestión de meses** — crear, duplicar (copia personas/proyectos/horas), cerrar, archivar, versiones restaurables.
6. **Gestión de proyectos** — CRUD, color, gerente responsable.
7. **Gestión de personas** — CRUD, cargo, horas disponibles, estado, cuenta vinculada.
8. **Configuración** — datos de la empresa, horas por defecto, usuarios, invitaciones.
9. **Comentarios** — hilo por celda, respuestas.
10. **Reportes** — resumen ejecutivo, gráficos, exportar a Excel/PDF.
11. **Historial** — auditoría completa de cambios (solo Administrador).

## Roles

- **Administrador**: todo, incluida gestión de usuarios y auditoría.
- **Gestor**: edita horas, proyectos, personas, meses; no administra usuarios.
- **Analista**: consulta, filtra, busca y comenta; no edita horas. Gestiona
  sus propias tareas y puede crear proyectos.
- **Analista de Tecnología**: solo Tareas y Cronograma, y solo lo asignado a
  él — no ve el trabajo del resto del equipo. Requiere que su cuenta esté
  vinculada a una persona del roster (Personas → Cuenta vinculada).

La seguridad real vive en las políticas RLS de `supabase/migrations/`, no en
la UI — el frontend solo oculta acciones que el backend rechazaría de todos
modos (ver `docs/ARQUITECTURA.md`).

## Empezar

```bash
npm install
cp .env.example .env   # completar con tu proyecto Supabase
npm run dev
```

Guía completa de puesta en marcha (crear el proyecto Supabase, aplicar
migraciones, bootstrap del primer administrador, desplegar en Cloudflare
Pages): [`docs/INSTALACION.md`](docs/INSTALACION.md).

Documentación completa del proyecto (módulos, reglas de negocio,
convenciones para extenderlo): [`docs/DOCUMENTACION.md`](docs/DOCUMENTACION.md).

Arquitectura, modelo de datos y matriz de permisos:
[`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Type-check + build de producción |
| `npm run preview` | Sirve el build de producción localmente |
| `npm run lint` | Lint (oxlint) |

## Línea gráfica

Paleta de marca CEINFES (variables CSS en `src/index.css`, modo claro/oscuro):

- Morado Formación `#5E4F9C` — primario
- Azul Pensamiento `#3A5BA7` — secundario
- Verde Transformación `#024B4E` — terciario
- Naranja `#EC671A` — acento

Los colores de estado de la grilla (verde/amarillo/rojo) son un set
semántico aparte, elegido para no confundirse con los tonos de marca.
