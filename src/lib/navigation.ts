import {
  BarChart3,
  Compass,
  CalendarRange,
  FolderKanban,
  GanttChartSquare,
  Grid3x3,
  History,
  KanbanSquare,
  LifeBuoy,
  LayoutDashboard,
  Settings,
  type LucideIcon,
} from "lucide-react"
import { GOBERNANZA_ROLES, TEAM_WIDE_ROLES, TICKET_ROLES } from "@/lib/roles"
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

// Los roles que trabajan la operación del día a día. El Estratega NO está:
// no tiene tablero ni cronograma propios, solo gobierna el portafolio. Si
// algún día se le abre un módulo operativo, se agrega aquí explícitamente.
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
    to: "/tickets",
    label: "Mesa de ayuda",
    icon: LifeBuoy,
    allow: TICKET_ROLES,
    description:
      "Los tickets que llegan por correo a soporte. Entran sin dueño y le salen a todo el equipo de tecnología: el primero que pueda lo toma, o el Coordinador lo reparte.",
    tips: [
      "Un ticket sin dueño lo puede tomar cualquiera del equipo de soporte.",
      "Al pasarlo a Completada, el solicitante recibe el correo de cierre.",
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
    // La ruta se queda igual (cambiarla rompería enlaces y marcadores ya
    // guardados); solo cambia el nombre que ve el equipo, que es lo que se
    // pidió — "Sábana" es como el equipo ya llama a la grilla en la
    // conversación diaria.
    label: "Sábana",
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
  {
    to: "/gobernanza",
    label: "Gobernanza",
    icon: Compass,
    allow: GOBERNANZA_ROLES,
    description:
      "La vista ejecutiva del portafolio: cuánto de lo presupuestado lleva ejecutado cada gestor mes a mes, qué entregables quedaron pendientes, y en qué fase del Doble Diamante va cada iniciativa comercial con su fecha de salida al mercado.",
    tips: [
      "El semáforo de ejecución es el mismo en todas partes: verde ≥90%, amarillo 70–89%, rojo <70%, azul si se pasó del presupuesto.",
      "En el pipeline, marcar un entregable del checklist es lo único que mueve el porcentaje de avance.",
      "Una iniciativa se pone en rojo cuando su fecha límite ya pasó y todavía le faltan entregables.",
      "El cronograma pone las iniciativas contra el calendario: la barra mide los días entre hoy y la fecha comprometida.",
    ],
  },
]

// Configuración del espacio de trabajo: se entra a esto para dejarlo listo,
// no todos los días. Por eso vive en el menú del avatar y no en la barra.
export const SETUP_ITEMS: NavItem[] = [
  {
    to: "/meses",
    label: "Meses",
    icon: CalendarRange,
    // Solo Administrador: el ciclo de vida del mes (crear, duplicar, cerrar,
    // archivar) es suyo. Los demás roles trabajan dentro del mes activo, que
    // eligen con el selector del encabezado.
    allow: ["administrador"],
    description:
      "Cada mes es una planificación aparte. Duplicar un mes copia el roster y el reparto de horas, así no se arranca de cero cada vez; los proyectos son durables y las tareas se quedan en su mes. Atajo: el selector de mes del encabezado tiene “Gestionar meses” al final de la lista.",
    tips: [
      "Duplicar un mes copia el roster y el reparto de horas.",
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
      "Datos de la empresa, usuarios, invitaciones y tarifas. Activar una cuenta suma sola a esa persona al equipo de los meses abiertos.",
    tips: [
      "Desde aquí se invita a alguien nuevo, se le asigna su rol y su cargo.",
      "El equipo no se arma a mano: activar o desactivar la cuenta lo hace por ti.",
    ],
  },
]

export const visibleFor = (items: NavItem[], role: AppRole | undefined | null) =>
  items.filter((item) => role && item.allow.includes(role))
