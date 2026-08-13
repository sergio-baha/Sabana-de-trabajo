import type { AppRole } from "@/types/database.types"

// Gating de UX únicamente — la barrera de seguridad real es RLS
// (supabase/migrations/*_profiles.sql, *_months.sql, etc). Estas funciones
// solo evitan mostrar acciones que el backend rechazaría de todos modos.
export const isAdmin = (role: AppRole | undefined | null) => role === "administrador"

export const isGestorOrAdmin = (role: AppRole | undefined | null) =>
  role === "administrador" || role === "gestor"

export const canEditHours = (role: AppRole | undefined | null) => isGestorOrAdmin(role)

export const canManageUsers = (role: AppRole | undefined | null) => isAdmin(role)

// El ciclo de vida del mes (crear, duplicar, editar, abrir/cerrar, archivar,
// versionar) es tarea exclusiva del Administrador. Ojo con la distinción: un
// Gestor sigue trabajando DENTRO de un mes abierto —horas, personas,
// proyectos, tareas—, lo que no hace es administrar el mes en sí. Espejo de
// las políticas de `months` en supabase/migrations/*_meses_solo_admin.sql.
export const canManageMonths = (role: AppRole | undefined | null) => isAdmin(role)

// El Analista de Tecnología no se distingue por *cuánto* puede hacer sino
// por *sobre qué*: solo su propio trabajo. Las políticas RLS acotan lo que
// lee y escribe a las filas donde figura como responsable, así que la UI no
// filtra nada — solo esconde los módulos que para él vendrían vacíos.
export const isAnalistaTecnologia = (role: AppRole | undefined | null) =>
  role === "analista_tecnologia"

// Los dos roles de analista gestionan tareas, pero solo las propias: no
// pueden asignarle trabajo a nadie más. Se separa de isAnalistaTecnologia
// a propósito — esa función decide qué *ve* cada quien (solo el Analista de
// Tecnología tiene la vista recortada), esta decide qué *escribe*. Espejo de
// `is_analista_role()` en la base.
export const writesOwnWorkOnly = (role: AppRole | undefined | null) =>
  role === "analista" || role === "analista_tecnologia"

// Dinero: presupuestos, tarifas, nómina y gastos. El Analista planea y
// consulta horas, no costos — no ve ninguna cifra en pesos, ni siquiera el
// campo de presupuesto al crear un proyecto. Las tarifas son un escalón más
// arriba todavía (solo Administrador, ver RatesCard y person_rates).
export const canSeeCosts = (role: AppRole | undefined | null) => isGestorOrAdmin(role)

// Quién puede crear y mover tarjetas en el tablero. Que un analista solo
// toque las suyas lo garantiza RLS, no este chequeo.
export const canManageTasks = (role: AppRole | undefined | null) =>
  isGestorOrAdmin(role) || writesOwnWorkOnly(role)

// Crear un proyecto desde el diálogo de tarea, cuando el proyecto al que
// pertenece el trabajo todavía no existe en el mes. Solo crear: editarlos y
// eliminarlos sigue siendo de Gestor/Administrador.
export const canCreateProjects = (role: AppRole | undefined | null) =>
  isGestorOrAdmin(role) || writesOwnWorkOnly(role)

// Quién puede registrar tiempo en el calendario del cronograma. Un Analista
// (a secas) sigue siendo de solo lectura.
export const canLogOwnTime = (role: AppRole | undefined | null) =>
  isGestorOrAdmin(role) || isAnalistaTecnologia(role)

// Entregar a revisión exige decir las horas reales. Solo se le pide a quien
// recibió el encargo: un Analista (a secas) sobre una tarea que no creó él.
// Espejo de `task_requires_time_report()` en la base — allí es la barrera, acá
// es para saber si hay que pedir el dato en pantalla.
export const requiresTimeReport = (
  role: AppRole | undefined | null,
  taskCreatedBy: string | null | undefined,
  profileId: string | undefined
) => role === "analista" && Boolean(profileId) && taskCreatedBy !== profileId

// Borrar una tarea: manda la autoría, con el alcance del rol encima. El
// Administrador borra cualquiera, el Gestor lo suyo y lo de los proyectos que
// gerencia, el Analista solo lo que él creó. Tener la tarea asignada no
// habilita el borrado — se entrega o se comenta, no se hace desaparecer.
// Espejo de `tasks_delete_write` (ver *_borrado_de_tareas_por_dueno.sql).
export const canDeleteTask = (
  role: AppRole | undefined | null,
  taskCreatedBy: string | null | undefined,
  profileId: string | undefined,
  managesProject: boolean
) => {
  if (isAdmin(role)) return true
  if (profileId && taskCreatedBy === profileId) return true
  return role === "gestor" && managesProject
}

export const roleLabel: Record<AppRole, string> = {
  administrador: "Administrador",
  gestor: "Gestor",
  analista: "Analista",
  analista_tecnologia: "Analista de Tecnología",
}

// Roles que ven los módulos de planeación de todo el equipo (dashboard,
// grilla, meses, proyectos, personas, reportes). Se declara en positivo
// para que agregar un rol nuevo obligue a decidir si entra, en vez de
// heredar acceso por omisión.
export const TEAM_WIDE_ROLES: AppRole[] = ["administrador", "gestor", "analista"]

// Orden en que se ofrecen los roles al invitar o al cambiar el rol de una
// cuenta, de mayor a menor alcance. Lista única para que agregar un rol no
// obligue a recordar cada `<Select>` donde aparece.
export const ASSIGNABLE_ROLES: AppRole[] = [
  "administrador",
  "gestor",
  "analista",
  "analista_tecnologia",
]

// Pantalla de entrada de cada rol. Es imprescindible que sea por rol y no
// una constante: el Analista de Tecnología no tiene acceso a /dashboard, así
// que redirigirlo allí (al entrar, o al rebotar de una ruta prohibida) lo
// dejaría rebotando entre /dashboard y RoleRoute indefinidamente.
export const homePathFor = (role: AppRole | undefined | null) =>
  isAnalistaTecnologia(role) ? "/tareas" : "/dashboard"
