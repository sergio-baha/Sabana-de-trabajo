import type { ComponentType } from "react"
import { createBrowserRouter } from "react-router"
import ProtectedRoute from "@/routes/ProtectedRoute"
import RoleRoute from "@/routes/RoleRoute"
import HomeRedirect from "@/routes/HomeRedirect"
import { TEAM_WIDE_ROLES } from "@/lib/roles"
import AppShell from "@/components/shared/AppShell"
import LoginPage from "@/features/auth/pages/LoginPage"
import ForgotPasswordPage from "@/features/auth/pages/ForgotPasswordPage"
import ResetPasswordPage from "@/features/auth/pages/ResetPasswordPage"
import ProfilePage from "@/features/auth/pages/ProfilePage"

// Marca de que ya se recargó por un chunk faltante, para no entrar en un
// bucle de recargas si el fallo es por otra causa (ej. sin conexión).
const STALE_RELOAD_KEY = "sabana-stale-chunk-reload"

// Páginas autenticadas cargadas bajo demanda (`lazy`, soportado nativamente
// por el data router de react-router): cada módulo -incluida la grilla con
// react-data-grid y Reportes con recharts/exportPdf, las dependencias más
// pesadas de la app- solo se descarga al navegar a esa ruta, en vez de
// viajar todo junto en el bundle inicial. react-router espera un export
// nombrado `Component`, así que se remapea el `export default` de cada
// página.
//
// El try/catch resuelve un problema real de producción: al desplegar, los
// archivos con hash viejo dejan de existir. Una pestaña que quedó abierta
// con el index anterior pide un chunk que ya no está y react-router muestra
// "Failed to fetch dynamically imported module". Recargar trae el index
// nuevo con los hashes correctos — que es justo lo que el usuario hacía a
// mano. Se hace una sola vez por sesión para no arriesgar un bucle.
const lazyPage = (importFn: () => Promise<{ default: ComponentType }>) =>
  async () => {
    try {
      const { default: Component } = await importFn()
      // Cargó bien: se limpia la marca para que un despliegue futuro en
      // esta misma sesión también pueda recargar.
      try {
        sessionStorage.removeItem(STALE_RELOAD_KEY)
      } catch {
        /* modo incógnito */
      }
      return { Component }
    } catch (error) {
      let alreadyReloaded = true
      try {
        alreadyReloaded = sessionStorage.getItem(STALE_RELOAD_KEY) === "1"
        if (!alreadyReloaded) sessionStorage.setItem(STALE_RELOAD_KEY, "1")
      } catch {
        /* sin sessionStorage no se intenta recargar */
      }

      if (!alreadyReloaded) {
        window.location.reload()
        // La página se está recargando; esta promesa nunca resuelve, así
        // react-router no alcanza a pintar la pantalla de error.
        return new Promise<{ Component: ComponentType }>(() => {})
      }
      throw error
    }
  }

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <HomeRedirect /> },
          // Módulos accesibles a todos los roles. El Analista de Tecnología
          // solo entra aquí: RLS le devuelve únicamente su propio trabajo,
          // así que las pantallas son las mismas para todos.
          {
            path: "tareas",
            lazy: lazyPage(() => import("@/features/tasks/pages/TareasPage")),
          },
          {
            path: "cronograma",
            lazy: lazyPage(() => import("@/features/schedule/pages/CronogramaPage")),
          },
          { path: "perfil", element: <ProfilePage /> },
          // Módulos de planeación de todo el equipo: quedan fuera del
          // alcance del Analista de Tecnología, que no ve el trabajo ajeno.
          {
            element: <RoleRoute allow={TEAM_WIDE_ROLES} />,
            children: [
              {
                path: "dashboard",
                lazy: lazyPage(() => import("@/features/dashboard/pages/DashboardPage")),
              },
              {
                path: "distribucion",
                lazy: lazyPage(() => import("@/features/grid/pages/DistribucionPage")),
              },
              {
                path: "meses",
                lazy: lazyPage(() => import("@/features/months/pages/MesesPage")),
              },
              {
                path: "proyectos",
                lazy: lazyPage(() => import("@/features/projects/pages/ProyectosPage")),
              },
              {
                path: "proyectos/:projectId",
                lazy: lazyPage(() => import("@/features/projects/pages/ProyectoDetallePage")),
              },
              {
                path: "personas",
                lazy: lazyPage(() => import("@/features/people/pages/PersonasPage")),
              },
              {
                path: "reportes",
                lazy: lazyPage(() => import("@/features/reports/pages/ReportesPage")),
              },
            ],
          },
          {
            element: <RoleRoute allow={["administrador"]} />,
            children: [
              {
                path: "historial",
                lazy: lazyPage(() => import("@/features/history/pages/HistorialPage")),
              },
              {
                path: "configuracion",
                lazy: lazyPage(() => import("@/features/settings/pages/ConfiguracionPage")),
              },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <HomeRedirect /> },
])
