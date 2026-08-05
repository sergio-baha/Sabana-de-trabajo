import type { AppRole } from "@/types/database.types"

// Gating de UX únicamente — la barrera de seguridad real es RLS
// (supabase/migrations/*_profiles.sql, *_months.sql, etc). Estas funciones
// solo evitan mostrar acciones que el backend rechazaría de todos modos.
export const isAdmin = (role: AppRole | undefined | null) => role === "administrador"

export const isGestorOrAdmin = (role: AppRole | undefined | null) =>
  role === "administrador" || role === "gestor"

export const canEditHours = (role: AppRole | undefined | null) => isGestorOrAdmin(role)

export const canManageUsers = (role: AppRole | undefined | null) => isAdmin(role)

// El Analista de Tecnología no se distingue por *cuánto* puede hacer sino
// por *sobre qué*: solo su propio trabajo. Las políticas RLS acotan lo que
// lee y escribe a las filas donde figura como responsable, así que la UI no
// filtra nada — solo esconde los módulos que para él vendrían vacíos.
export const isAnalistaTecnologia = (role: AppRole | undefined | null) =>
  role === "analista_tecnologia"

// Quién puede crear y mover tarjetas en el tablero. El analista de
// tecnología solo mueve las suyas; eso lo garantiza RLS, no este chequeo.
export const canManageTasks = (role: AppRole | undefined | null) =>
  isGestorOrAdmin(role) || isAnalistaTecnologia(role)

// Quién puede registrar tiempo en el calendario del cronograma. Un Analista
// (a secas) sigue siendo de solo lectura.
export const canLogOwnTime = (role: AppRole | undefined | null) =>
  isGestorOrAdmin(role) || isAnalistaTecnologia(role)

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
