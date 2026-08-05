import { useState } from "react"
import { Link, Outlet, useLocation, useNavigate } from "react-router"
import {
  CalendarRange,
  FolderKanban,
  GanttChartSquare,
  Grid3x3,
  History,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  Sun,
  Users,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useSessionStore } from "@/stores/sessionStore"
import MonthSwitcher from "@/components/shared/MonthSwitcher"
import { applyTheme, getSavedTheme, type Theme } from "@/lib/theme"
import { roleLabel, TEAM_WIDE_ROLES } from "@/lib/roles"
import { signOut } from "@/features/auth/api/authApi"
import type { AppRole } from "@/types/database.types"

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  allow: AppRole[]
}

const ALL_ROLES: AppRole[] = [...TEAM_WIDE_ROLES, "analista_tecnologia"]

// `allow` se declara siempre, incluso cuando son todos los roles: así,
// agregar un rol nuevo obliga a decidir explícitamente qué módulos ve, en
// vez de heredar acceso por omisión. Debe ir en línea con las mismas
// restricciones del router (RoleRoute) — esto solo oculta el enlace.
const NAV_ITEMS: NavItem[] = [
  { to: "/tareas", label: "Tareas", icon: KanbanSquare, allow: ALL_ROLES },
  { to: "/cronograma", label: "Cronograma", icon: GanttChartSquare, allow: ALL_ROLES },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, allow: TEAM_WIDE_ROLES },
  { to: "/distribucion", label: "Distribución de trabajo", icon: Grid3x3, allow: TEAM_WIDE_ROLES },
  { to: "/meses", label: "Meses", icon: CalendarRange, allow: TEAM_WIDE_ROLES },
  { to: "/proyectos", label: "Proyectos", icon: FolderKanban, allow: TEAM_WIDE_ROLES },
  { to: "/personas", label: "Personas", icon: Users, allow: TEAM_WIDE_ROLES },
  { to: "/reportes", label: "Reportes", icon: FolderKanban, allow: TEAM_WIDE_ROLES },
  { to: "/historial", label: "Historial", icon: History, allow: ["administrador"] },
  { to: "/configuracion", label: "Configuración", icon: Settings, allow: ["administrador"] },
]

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase() || "?"
}

export default function AppShell() {
  const profile = useSessionStore((s) => s.profile)
  const location = useLocation()
  const navigate = useNavigate()
  const [theme, setTheme] = useState<Theme>(getSavedTheme)

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    applyTheme(next)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate("/login", { replace: true })
  }

  const visibleItems = NAV_ITEMS.filter(
    (item) => profile && item.allow.includes(profile.role)
  )

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          {/* En modo ícono el rail mide 48px: se quita el padding lateral y
              el gap para que el logo quede centrado y no desplazado. */}
          <div className="flex items-center gap-2.5 px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0">
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ background: "var(--gradient-brand)", boxShadow: "var(--sh-orange)" }}
            >
              DT
            </div>
            <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">
              Distribución de Trabajo
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Módulos</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname.startsWith(item.to)}
                      tooltip={item.label}
                    >
                      <Link to={item.to}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          {profile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {/* size=lg pone p-0 en modo ícono, así que el avatar se
                    centra a mano para que no quede pegado al borde. */}
                <SidebarMenuButton
                  size="lg"
                  className="group-data-[collapsible=icon]:justify-center"
                >
                  <Avatar className="size-7 shrink-0">
                    <AvatarFallback className="bg-sidebar-accent text-xs text-sidebar-accent-foreground">
                      {initialsFor(profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col overflow-hidden text-left group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-sm font-medium">{profile.full_name}</span>
                    <span className="truncate text-xs opacity-70">{roleLabel[profile.role]}</span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel>{profile.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/perfil">Mi perfil</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleTheme}>
                  {theme === "dark" ? <Sun /> : <Moon />}
                  {theme === "dark" ? "Modo claro" : "Modo oscuro"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
                  <LogOut />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="surface-glass sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-x-0 border-t-0 border-b border-border px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <MonthSwitcher />
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </header>
        {/* key por ruta: reinicia la animación de entrada en cada navegación */}
        <main key={location.pathname} className="page-enter flex flex-1 flex-col gap-4 p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
