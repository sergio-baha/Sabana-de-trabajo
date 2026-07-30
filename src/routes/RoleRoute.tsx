import { Navigate, Outlet } from "react-router"
import { useSessionStore } from "@/stores/sessionStore"
import type { AppRole } from "@/types/database.types"

interface RoleRouteProps {
  allow: AppRole[]
}

// Gating de UX/navegación. La barrera de seguridad real vive en las
// políticas RLS (supabase/migrations/) — esto solo evita que un usuario sin
// permisos llegue a una pantalla cuyas acciones el backend rechazaría.
export default function RoleRoute({ allow }: RoleRouteProps) {
  const profile = useSessionStore((s) => s.profile)

  if (!profile || !allow.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
