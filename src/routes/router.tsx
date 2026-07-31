import type { ComponentType } from "react"
import { createBrowserRouter, Navigate } from "react-router"
import ProtectedRoute from "@/routes/ProtectedRoute"
import RoleRoute from "@/routes/RoleRoute"
import AppShell from "@/components/shared/AppShell"
import LoginPage from "@/features/auth/pages/LoginPage"
import ForgotPasswordPage from "@/features/auth/pages/ForgotPasswordPage"
import ResetPasswordPage from "@/features/auth/pages/ResetPasswordPage"
import ProfilePage from "@/features/auth/pages/ProfilePage"

// Páginas autenticadas cargadas bajo demanda (`lazy`, soportado nativamente
// por el data router de react-router): cada módulo -incluida la grilla con
// react-data-grid y Reportes con recharts/exportPdf, las dependencias más
// pesadas de la app- solo se descarga al navegar a esa ruta, en vez de
// viajar todo junto en el bundle inicial. react-router espera un export
// nombrado `Component`, así que se remapea el `export default` de cada
// página.
const lazyPage = (importFn: () => Promise<{ default: ComponentType }>) =>
  async () => {
    const { default: Component } = await importFn()
    return { Component }
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
          { index: true, element: <Navigate to="/dashboard" replace /> },
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
            path: "personas",
            lazy: lazyPage(() => import("@/features/people/pages/PersonasPage")),
          },
          {
            path: "reportes",
            lazy: lazyPage(() => import("@/features/reports/pages/ReportesPage")),
          },
          { path: "perfil", element: <ProfilePage /> },
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
  { path: "*", element: <Navigate to="/dashboard" replace /> },
])
