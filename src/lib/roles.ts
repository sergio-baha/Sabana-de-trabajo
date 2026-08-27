import type { AppRole } from "@/types/database.types"

// Gating de UX únicamente — la barrera de seguridad real es RLS
// (supabase/migrations/*_profiles.sql, *_months.sql, etc). Estas funciones
// solo evitan mostrar acciones que el backend rechazaría de todos modos.
export const isAdmin = (role: AppRole | undefined | null) => role === "administrador"

export const isGestorOrAdmin = (role: AppRole | undefined | null) =>
  role === "administrador" || role === "gestor"

// El Coordinador reparte trabajo y supervisa, pero no planea capacidad: ve
// los tableros del equipo como un Gestor y NO toca la sábana de horas, los
// meses ni las tarifas. Espejo de `is_coordinador()` en la base.
export const isCoordinador = (role: AppRole | undefined | null) => role === "coordinador"

// Quién ve el trabajo de TODO el equipo, no solo el propio. Antes esto era
// `isGestorOrAdmin` a secas; se separa porque el Coordinador supervisa sin
// tener las llaves de la planeación — que es justo lo que lo distingue del
// Gestor.
export const seesTeamWork = (role: AppRole | undefined | null) =>
  isGestorOrAdmin(role) || isCoordinador(role)

// La bandeja de la mesa de ayuda. Un ticket entra SIN DUEÑO y le sale a todo
// Analista de Tecnología, que puede tomarlo; el Coordinador y el
// Administrador lo asignan a quien corresponda. Espejo de la rama
// `ticket_number is not null` en `tasks_select_scoped`.
export const seesTickets = (role: AppRole | undefined | null) =>
  isAnalistaTecnologia(role) || isCoordinador(role) || isAdmin(role)

// Asignarle un ticket a OTRA persona. El Analista de Tecnología solo puede
// tomarlo para sí mismo, y eso no pasa por acá. Espejo de
// `can_assign_tickets()`.
export const canAssignTickets = (role: AppRole | undefined | null) =>
  isAdmin(role) || isCoordinador(role)

// El Estratega mira el portafolio: ejecución presupuestal por gestor y avance
// del pipeline comercial. No reparte horas, no cierra meses, no toca tareas —
// su módulo es Gobernanza y nada más. Espejo de `is_estratega()` en la base.
export const isEstratega = (role: AppRole | undefined | null) => role === "estratega"

// Quién entra a Gobernanza. El Administrador siempre: si el acceso al módulo
// dependiera solo del rol nuevo, la salida de esa persona dejaría el tablero
// sin nadie que pueda ni corregir un dato. Mismo criterio que la mesa de
// ayuda. Espejo de `sees_gobernanza()`.
export const seesGobernanza = (role: AppRole | undefined | null) =>
  isEstratega(role) || isAdmin(role)

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
  coordinador: "Coordinador",
  analista: "Analista",
  analista_tecnologia: "Analista de Tecnología",
  estratega: "Estratega",
}

// Roles que ven los módulos de planeación de todo el equipo (dashboard,
// grilla, meses, proyectos, personas, reportes). Se declara en positivo
// para que agregar un rol nuevo obligue a decidir si entra, en vez de
// heredar acceso por omisión.
// El Coordinador entra acá porque supervisa el trabajo del equipo. Ojo: esto
// le abre los módulos de planeación en la navegación, pero NO le da permiso
// de escritura sobre ellos — eso lo siguen decidiendo `canEditHours`,
// `canManageMonths` y la RLS, que no lo incluyen.
export const TEAM_WIDE_ROLES: AppRole[] = [
  "administrador",
  "gestor",
  "coordinador",
  "analista",
]

// Quién entra al módulo de Gobernanza. Se declara como lista aparte —y no
// como `seesGobernanza`— porque el router necesita un array de roles, no un
// predicado. Las dos formas dicen lo mismo y se cambian juntas.
export const GOBERNANZA_ROLES: AppRole[] = ["estratega", "administrador"]

// Quién entra a la mesa de ayuda. Se declara como lista aparte —y no como
// `seesTickets`— porque el router necesita un array de roles, no un
// predicado. Las dos formas dicen lo mismo y deben cambiarse juntas.
export const TICKET_ROLES: AppRole[] = [
  "administrador",
  "coordinador",
  "analista_tecnologia",
]

// Orden en que se ofrecen los roles al invitar o al cambiar el rol de una
// cuenta, de mayor a menor alcance. Lista única para que agregar un rol no
// obligue a recordar cada `<Select>` donde aparece.
export const ASSIGNABLE_ROLES: AppRole[] = [
  "administrador",
  "gestor",
  "coordinador",
  "estratega",
  "analista",
  "analista_tecnologia",
]

// Pantalla de entrada de cada rol. Es imprescindible que sea por rol y no
// una constante: el Analista de Tecnología no tiene acceso a /dashboard, así
// que redirigirlo allí (al entrar, o al rebotar de una ruta prohibida) lo
// dejaría rebotando entre /dashboard y RoleRoute indefinidamente.
export const homePathFor = (role: AppRole | undefined | null) => {
  if (isAnalistaTecnologia(role)) return "/tareas"
  if (isEstratega(role)) return "/gobernanza"
  return "/dashboard"
}
