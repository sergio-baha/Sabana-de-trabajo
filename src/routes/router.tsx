import { createBrowserRouter, Navigate } from "react-router"
import ProtectedRoute from "@/routes/ProtectedRoute"
import RoleRoute from "@/routes/RoleRoute"
import AppShell from "@/components/shared/AppShell"
import LoginPage from "@/features/auth/pages/LoginPage"
import ForgotPasswordPage from "@/features/auth/pages/ForgotPasswordPage"
import ResetPasswordPage from "@/features/auth/pages/ResetPasswordPage"
import ProfilePage from "@/features/auth/pages/ProfilePage"
import DashboardPage from "@/features/dashboard/pages/DashboardPage"
import DistribucionPage from "@/features/grid/pages/DistribucionPage"
import MesesPage from "@/features/months/pages/MesesPage"
import ProyectosPage from "@/features/projects/pages/ProyectosPage"
import PersonasPage from "@/features/people/pages/PersonasPage"
import ReportesPage from "@/features/reports/pages/ReportesPage"
import HistorialPage from "@/features/history/pages/HistorialPage"
import ConfiguracionPage from "@/features/settings/pages/ConfiguracionPage"

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
          { path: "dashboard", element: <DashboardPage /> },
          { path: "distribucion", element: <DistribucionPage /> },
          { path: "distribucion/:monthId", element: <DistribucionPage /> },
          { path: "meses", element: <MesesPage /> },
          { path: "proyectos", element: <ProyectosPage /> },
          { path: "personas", element: <PersonasPage /> },
          { path: "reportes", element: <ReportesPage /> },
          { path: "perfil", element: <ProfilePage /> },
          {
            element: <RoleRoute allow={["administrador"]} />,
            children: [
              { path: "historial", element: <HistorialPage /> },
              { path: "configuracion", element: <ConfiguracionPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/dashboard" replace /> },
])
