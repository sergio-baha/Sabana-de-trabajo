import {
  BarChart3,
  CalendarRange,
  FolderKanban,
  GanttChartSquare,
  Grid3x3,
  History,
  KanbanSquare,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react"
import { TEAM_WIDE_ROLES } from "@/lib/roles"
import type { AppRole } from "@/types/database.types"

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  allow: AppRole[]
  /** Para qué sirve el módulo. Lo usa el recorrido de bienvenida. */
  description: string
  /**
   * Dos o tres cosas concretas que se hacen en el módulo. El recorrido las
   * muestra como lista debajo de la descripción: leer "arrastra la tarjeta
   * para cambiarle el estado" enseña más que un párrafo sobre el tablero.
   */
  tips: string[]
}

export const ALL_ROLES: AppRole[] = [...TEAM_WIDE_ROLES, "analista_tecnologia"]

// Fuente única de la navegación: la barra lateral, los títulos del header y
// el recorrido de bienvenida leen de aquí. Antes las listas vivían dentro de
// AppShell, y agregar un módulo obligaba a acordarse de explicarlo aparte.
//
// `allow` se declara siempre, incluso cuando son todos los roles: así,
// agregar un rol nuevo obliga a decidir explícitamente qué módulos ve, en
// vez de heredar acceso por omisión. Debe ir en línea con las mismas
// restricciones del router (RoleRoute) — esto solo oculta el enlace.
export const NAV_ITEMS: NavItem[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    allow: TEAM_WIDE_ROLES,
    description:
      "El resumen del mes activo: cuántas horas hay disponibles, cuántas están repartidas y quién quedó sobreasignado. Es el mejor punto de partida para saber cómo va el equipo.",
    tips: [
      "El semáforo manda: verde es exacto, amarillo faltan horas, rojo sobran.",
      "Desde la lista de atención llegas directo a la persona o el proyecto con problema.",
    ],
  },
  {
    to: "/tareas",
    label: "Tareas",
    icon: KanbanSquare,
    allow: ALL_ROLES,
    description:
      "Tu tablero de trabajo. Las tarjetas se arrastran entre columnas para cambiar su estado, y en el backlog puedes verlas como lista para planear. Solo aparecen las tareas de los proyectos donde participas.",
    tips: [
      "Arrastra una tarjeta de una columna a otra para cambiarle el estado.",
      "En el backlog las ves como lista, con filtros, para planear con calma.",
    ],
  },
  {
    to: "/cronograma",
    label: "Cronograma",
    icon: GanttChartSquare,
    allow: ALL_ROLES,
    description:
      "Tus tareas ubicadas en el tiempo (Gantt) y el calendario donde registras las horas que realmente trabajaste cada día.",
    tips: [
      "La vista Gantt muestra tus tareas ubicadas en el tiempo.",
      "En el calendario registras las horas que trabajaste cada día.",
    ],
  },
  {
    to: "/proyectos",
    label: "Proyectos",
    icon: FolderKanban,
    allow: TEAM_WIDE_ROLES,
    description:
      "Todos los proyectos, de todos los meses. Al entrar a uno gestionas sus fases, su equipo y sus tareas. Arriba aparecen los que puedes gestionar; abajo, los que solo puedes consultar.",
    tips: [
      "Entra a un proyecto para gestionar sus fases, su equipo y sus tareas.",
      "Arriba están los que gestionas; abajo, los que solo consultas.",
    ],
  },
  {
    to: "/distribucion",
    label: "Distribución",
    icon: Grid3x3,
    allow: TEAM_WIDE_ROLES,
    description:
      "La grilla de horas: filas de proyectos por columnas de personas. Se edita directamente en la celda y se guarda solo. Los colores avisan si a alguien le faltan o le sobran horas.",
    tips: [
      "Escribe las horas en la celda: se guardan solas, no hay botón de guardar.",
      "Puedes pegar valores desde Excel, y limpiar una fila entera desde su menú.",
      "El botón de la esquina de cada celda abre su detalle: actividades y comentarios.",
    ],
  },
  {
    to: "/reportes",
    label: "Reportes",
    icon: BarChart3,
    allow: TEAM_WIDE_ROLES,
    description:
      "El resumen ejecutivo del mes, listo para exportar a Excel o PDF y compartirlo fuera de la plataforma.",
    tips: ["Exporta el mes a Excel o PDF para compartirlo fuera de la plataforma."],
  },
]

// Configuración del espacio de trabajo: se entra a esto para dejarlo listo,
// no todos los días. Por eso vive en el menú del avatar y no en la barra.
export const SETUP_ITEMS: NavItem[] = [
  {
    to: "/personas",
    label: "Personas",
    icon: Users,
    allow: TEAM_WIDE_ROLES,
    description:
      "El equipo del mes: cargo, horas disponibles y la cuenta de la plataforma con la que se vincula cada quien. Ese vínculo es el que hace que alguien vea sus propias tareas.",
    tips: [
      "Vincula cada persona con su cuenta: ese vínculo le muestra sus tareas.",
      "Ahí se definen las horas disponibles de cada quien en el mes.",
    ],
  },
  {
    to: "/meses",
    label: "Meses",
    icon: CalendarRange,
    allow: TEAM_WIDE_ROLES,
    description:
      "Cada mes es una planificación aparte. Duplicar un mes copia personas, proyectos, equipos y tareas, así no se arranca de cero cada vez. Atajo: el selector de mes del encabezado tiene “Gestionar meses” al final de la lista.",
    tips: [
      "Duplicar un mes copia personas, proyectos, equipos y tareas.",
      "Cerrar un mes congela sus horas; las tareas se siguen trabajando.",
    ],
  },
  {
    to: "/historial",
    label: "Historial",
    icon: History,
    allow: ["administrador"],
    description:
      "La auditoría: quién cambió qué, cuándo, y cuál era el valor anterior.",
    tips: ["Busca por módulo o por persona para reconstruir qué pasó con un dato."],
  },
  {
    to: "/configuracion",
    label: "Configuración",
    icon: Settings,
    allow: ["administrador"],
    description:
      "Datos de la empresa, horas por defecto, y el alta de usuarios e invitaciones.",
    tips: ["Desde aquí se invita a alguien nuevo y se le asigna su rol."],
  },
]

export const visibleFor = (items: NavItem[], role: AppRole | undefined | null) =>
  items.filter((item) => role && item.allow.includes(role))
