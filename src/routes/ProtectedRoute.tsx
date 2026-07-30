import { Navigate, Outlet, useLocation } from "react-router"
import { useSessionStore } from "@/stores/sessionStore"

export default function ProtectedRoute() {
  const status = useSessionStore((s) => s.status)
  const location = useLocation()

  if (status === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background text-sm text-muted-foreground">
        Cargando…
      </div>
    )
  }

  if (status === "signed-out") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
