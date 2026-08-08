import { useState, type CSSProperties } from "react"
import { Link, Outlet, useLocation, useNavigate } from "react-router"
import {
  BarChart3,
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
  UserRound,
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

interface NavSection {
  label: string
  items: NavItem[]
}

const ALL_ROLES: AppRole[] = [...TEAM_WIDE_ROLES, "analista_tecnologia"]

// `allow` se declara siempre, incluso cuando son todos los roles: así,
// agregar un rol nuevo obliga a decidir explícitamente qué módulos ve, en
// vez de heredar acceso por omisión. Debe ir en línea con las mismas
// restricciones del router (RoleRoute) — esto solo oculta el enlace.
//
// Los módulos van agrupados por para qué sirven, no en una lista corrida:
// con diez enlaces seguidos había que leerlos todos para encontrar uno. El
// corte también coincide con los roles — el Analista de Tecnología solo ve
// el primer grupo, así que para él el menú se reduce a lo suyo.
const NAV_SECTIONS: NavSection[] = [
  {
    label: "Mi trabajo",
    items: [
      { to: "/tareas", label: "Tareas", icon: KanbanSquare, allow: ALL_ROLES },
      { to: "/cronograma", label: "Cronograma", icon: GanttChartSquare, allow: ALL_ROLES },
    ],
  },
  {
    label: "Planeación",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, allow: TEAM_WIDE_ROLES },
      {
        to: "/distribucion",
        label: "Distribución de trabajo",
        icon: Grid3x3,
        allow: TEAM_WIDE_ROLES,
      },
      { to: "/meses", label: "Meses", icon: CalendarRange, allow: TEAM_WIDE_ROLES },
      { to: "/proyectos", label: "Proyectos", icon: FolderKanban, allow: TEAM_WIDE_ROLES },
      { to: "/personas", label: "Personas", icon: Users, allow: TEAM_WIDE_ROLES },
      { to: "/reportes", label: "Reportes", icon: BarChart3, allow: TEAM_WIDE_ROLES },
    ],
  },
  {
    label: "Administración",
    items: [
      { to: "/historial", label: "Historial", icon: History, allow: ["administrador"] },
      { to: "/configuracion", label: "Configuración", icon: Settings, allow: ["administrador"] },
    ],
  },
]

// Título que se muestra en la barra superior. Se saca del propio menú para
// no mantener dos listas de nombres; `/perfil` no está en el menú, así que
// va aparte.
const PAGE_TITLES: Record<string, string> = {
  ...Object.fromEntries(
    NAV_SECTIONS.flatMap((section) => section.items).map((item) => [item.to, item.label])
  ),
  "/perfil": "Mi perfil",
}

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

  // Un grupo sin módulos visibles no debe pintar ni su encabezado.
  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => profile && item.allow.includes(profile.role)),
  })).filter((section) => section.items.length > 0)

  const currentTitle = PAGE_TITLES[location.pathname] ?? "Distribución de Trabajo"

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="relative">
          {/* En modo ícono el rail mide 48px: se quita el padding lateral y
              el gap para que el logo quede centrado y no desplazado. */}
          <div className="flex items-center gap-2.5 px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0">
            <div className="relative shrink-0">
              {/* Resplandor detrás del logo, en la misma capa que el logo y
                  desenfocado: es lo que hace que la marca "encienda". */}
              <div
                aria-hidden
                className="animate-glow absolute inset-0 rounded-xl blur-md"
                style={{ background: "var(--gradient-brand)" }}
              />
              <div
                className="relative flex size-9 items-center justify-center rounded-xl text-sm font-bold tracking-tight text-white"
                style={{ background: "var(--gradient-brand)", boxShadow: "var(--sh-orange)" }}
              >
                DT
              </div>
            </div>
            <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm leading-tight font-semibold">
                Distribución
              </span>
              <span className="text-eyebrow truncate text-muted-foreground">
                de trabajo
              </span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="relative">
          {visibleSections.map((section) => (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item, index) => (
                    // El escalonado va en el <li> y no en el enlace: la
                    // animación termina con `both`, así que dejaría fijado un
                    // `transform` sobre el enlace y anularía el desplazamiento
                    // al pasar el mouse. Además el retardo corre por grupo,
                    // para que no crezca con el total de módulos.
                    <SidebarMenuItem
                      key={item.to}
                      className="stagger-item"
                      style={{ "--i": index } as CSSProperties}
                    >
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
          ))}
        </SidebarContent>
        <SidebarFooter>
          {profile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {/* size=lg pone p-0 en modo ícono, así que el avatar se
                    centra a mano para que no quede pegado al borde. */}
                <SidebarMenuButton
                  size="lg"
                  className="border border-sidebar-border bg-sidebar-accent/40 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent"
                >
                  <Avatar className="size-8 shrink-0">
                    {/* Iniciales sobre el gradiente de marca: es el único
                        avatar de la app, así que carga la identidad. */}
                    <AvatarFallback
                      className="text-xs font-semibold text-white"
                      style={{ background: "var(--gradient-brand)" }}
                    >
                      {initialsFor(profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col overflow-hidden text-left group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-sm font-medium">{profile.full_name}</span>
                    <span className="truncate text-xs opacity-70">{roleLabel[profile.role]}</span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-60">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold">{profile.full_name}</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    {profile.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/perfil">
                    <UserRound />
                    Mi perfil
                  </Link>
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
        <header className="surface-glass sticky top-0 z-30 flex h-15 shrink-0 items-center gap-3 border-x-0 border-t-0 border-b border-border px-4">
          {/* Filo de gradiente sobre el borde inferior: separa el header del
              contenido con color de marca en vez de una línea gris más. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -bottom-px h-px opacity-70"
            style={{ background: "var(--gradient-brand)" }}
          />
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          {/* El título vive aquí y no en cada página: da contexto al volver a
              la pestaña sin que cada módulo tenga que repetir su encabezado.
              La `key` reinicia la animación al navegar. */}
          <h1
            key={location.pathname}
            className="animate-fade-in hidden truncate text-sm font-semibold sm:block"
          >
            {currentTitle}
          </h1>
          <Separator orientation="vertical" className="hidden h-4 sm:block" />
          <MonthSwitcher />
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          >
            {/* El ícono gira al entrar, así el cambio de tema se percibe como
                una acción y no como un parpadeo. */}
            {theme === "dark" ? (
              <Sun className="animate-scale-in" />
            ) : (
              <Moon className="animate-scale-in" />
            )}
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
