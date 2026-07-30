import type { AppRole } from "@/types/database.types"

// Gating de UX únicamente — la barrera de seguridad real es RLS
// (supabase/migrations/*_profiles.sql, *_months.sql, etc). Estas funciones
// solo evitan mostrar acciones que el backend rechazaría de todos modos.
export const isAdmin = (role: AppRole | undefined | null) => role === "administrador"

export const isGestorOrAdmin = (role: AppRole | undefined | null) =>
  role === "administrador" || role === "gestor"

export const canEditHours = (role: AppRole | undefined | null) => isGestorOrAdmin(role)

export const canManageUsers = (role: AppRole | undefined | null) => isAdmin(role)

export const roleLabel: Record<AppRole, string> = {
  administrador: "Administrador",
  gestor: "Gestor",
  analista: "Analista",
}
