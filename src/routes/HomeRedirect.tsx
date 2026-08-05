import { Navigate } from "react-router"
import { useSessionStore } from "@/stores/sessionStore"
import { homePathFor } from "@/lib/roles"

// Entrada de la app ("/") y comodín de rutas desconocidas. No puede ser un
// `<Navigate to="/dashboard">` fijo: el Analista de Tecnología no tiene
// acceso a /dashboard y quedaría rebotando contra RoleRoute.
export default function HomeRedirect() {
  const profile = useSessionStore((s) => s.profile)
  return <Navigate to={homePathFor(profile?.role)} replace />
}
