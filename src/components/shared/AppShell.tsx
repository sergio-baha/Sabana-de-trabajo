import { useState } from "react"
import { Link, Outlet, useLocation, useNavigate } from "react-router"
import {
  CalendarRange,
  FolderKanban,
  Grid3x3,
  History,
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
import { roleLabel } from "@/lib/roles"
import { signOut } from "@/features/auth/api/authApi"
import type { AppRole } from "@/types/database.types"

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  allow?: AppRole[]
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/distribucion", label: "Distribución de trabajo", icon: Grid3x3 },
  { to: "/meses", label: "Meses", icon: CalendarRange },
  { to: "/proyectos", label: "Proyectos", icon: FolderKanban },
  { to: "/personas", label: "Personas", icon: Users },
  { to: "/reportes", label: "Reportes", icon: FolderKanban },
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
    (item) => !item.allow || (profile && item.allow.includes(profile.role))
  )

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
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
                <SidebarMenuButton size="lg">
                  <Avatar className="size-6">
                    <AvatarFallback className="text-xs">
                      {initialsFor(profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col overflow-hidden text-left group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-sm font-medium">{profile.full_name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {roleLabel[profile.role]}
                    </span>
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
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <MonthSwitcher />
          <Button variant="ghost" size="icon" className="ml-auto" onClick={toggleTheme}>
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
