import { useMemo, useRef, useState } from "react"
import { DataGrid, type Column, type PositionChangeArgs } from "react-data-grid"
import "react-data-grid/lib/styles.css"
import {
  AlertTriangle,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Check,
  Eraser,
  CheckCircle2,
  EyeOff,
  Grid3x3,
  Layers,
  Lock,
  MoreHorizontal,
  NotebookText,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  Zap,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import NoActiveMonth from "@/components/shared/NoActiveMonth"
import EmptyState from "@/components/shared/EmptyState"
import PageHeader from "@/components/shared/PageHeader"
import {
  usePeople,
  useSeedMonthPeople,
  useUpdatePerson,
} from "@/features/people/hooks/usePeopleQueries"
import { useMonths, useSetPlanningReady } from "@/features/months/hooks/useMonthsQueries"
import { usePlanningExclusions } from "@/features/people/hooks/usePlanningExclusions"
import {
  useDeleteProject,
  useProjectManagers,
  useProjectMembers,
  useProjects,
} from "@/features/projects/hooks/useProjectsQueries"
import type { Project } from "@/features/projects/api/projectsApi"
import type { ProjectCategory } from "@/types/database.types"
import ProjectFormDialog from "@/features/projects/components/ProjectFormDialog"
import ProjectLineFormDialog from "@/features/grid/components/ProjectLineFormDialog"
import {
  useCreateProjectLine,
  useDeleteProjectLine,
  useProjectLines,
  useRenameProjectLine,
} from "@/features/projects/hooks/useProjectLinesQueries"
import type { ProjectLine } from "@/features/projects/api/projectLinesApi"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  useAllocations,
  useClearAllocations,
  useUpsertAllocation,
} from "@/features/grid/hooks/useAllocationsQueries"
import { useRealtimeAllocations } from "@/features/grid/hooks/useRealtimeAllocations"
import {
  buildPersonSummaries,
  buildProjectGridRows,
  rowKeyFor,
  sortActiveProjectsFirst,
  type PersonSummary,
  type ProjectGridRow,
  type SummaryRow,
} from "@/features/grid/lib/gridRows"
import { tintBackground } from "@/features/grid/lib/colorContrast"
import HoursEditCell from "@/features/grid/components/HoursEditCell"
import AvailableHoursCell from "@/features/grid/components/AvailableHoursCell"
import { useCommentsByCell, useRealtimeComments } from "@/features/comments/hooks/useCommentsQueries"
import {
  cellKey,
  useActivitiesByCell,
  useRealtimeActivities,
} from "@/features/activities/hooks/useActivitiesQueries"
import CellDetailsDialog, { type CellTab } from "@/features/grid/components/CellDetailsDialog"
import { useActiveMonthStore } from "@/stores/activeMonthStore"
import { useSessionStore } from "@/stores/sessionStore"
import { isAdmin, isGestorOrAdmin } from "@/lib/roles"
import { cn } from "@/lib/utils"
import { useTasks, useTaskAssignees } from "@/features/tasks/hooks/useTasksQueries"
import { buildAssigneeIdsByTask } from "@/features/tasks/lib/taskAssignees"
import { findDueDateConflicts } from "@/features/schedule/lib/scheduleRange"

type SortField = "name" | "total"

const STATUS_CLASS: Record<PersonSummary["statusColor"], string> = {
  verde: "bg-success-muted text-success",
  amarillo: "bg-warning-muted text-warning",
  rojo: "bg-danger-muted text-danger",
}

// Filas = proyectos, columnas = personas (igual que la hoja Julio.xlsx
// original), con los totales/disponibles por persona resumidos al final de
// la tabla en vez de al final de cada fila — ver buildPersonSummaries en
// gridRows.ts y bottomSummaryRows más abajo.
export default function DistribucionPage() {
  const { activeMonthId } = useActiveMonthStore()
  const profile = useSessionStore((s) => s.profile)
  // Acá el candado del mes SÍ aplica: esta grilla edita horas, que es
  // exactamente lo que un mes cerrado congela (can_write_month en la base).
  // Sin este chequeo la grilla se veía editable y el rechazo solo aparecía
  // al guardar — el mismo hueco que tenía el tablero de tareas, donde en
  // cambio se resolvió al revés porque las tareas ya no dependen del mes.
  const { data: months } = useMonths()
  const activeMonth = months?.find((m) => m.id === activeMonthId)
  const monthLocked = Boolean(activeMonth && activeMonth.status !== "abierto")
  const setPlanningReady = useSetPlanningReady()
  const canEdit = isGestorOrAdmin(profile?.role) && (!monthLocked || isAdmin(profile?.role))

  const { data: people, isLoading: loadingPeople } = usePeople(activeMonthId)
  const { data: projects, isLoading: loadingProjects } = useProjects()
  const { data: lines } = useProjectLines()
  const { data: allocations, isLoading: loadingAllocations } = useAllocations(activeMonthId)
  const upsertAllocation = useUpsertAllocation(activeMonthId ?? "")
  const createLine = useCreateProjectLine()
  const renameLine = useRenameProjectLine()
  const deleteLine = useDeleteProjectLine()
  const clearAllocations = useClearAllocations(activeMonthId ?? "")
  const seedPeople = useSeedMonthPeople(activeMonthId ?? "")
  const updatePerson = useUpdatePerson(activeMonthId ?? "")
  useRealtimeAllocations(activeMonthId)
  const { byCell: commentsByCell } = useCommentsByCell(activeMonthId)
  useRealtimeComments(activeMonthId)
  const { byCell: activitiesByCell } = useActivitiesByCell(activeMonthId)
  useRealtimeActivities(activeMonthId)

  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  // Un solo diálogo por celda (actividades + comentarios en pestañas): antes
  // eran dos estados y dos botones casi iguales dentro de cada celda.
  const [detailCell, setDetailCell] = useState<{
    personId: string
    projectId: string
    lineId: string
    tab: CellTab
  } | null>(null)
  // Fila (o grilla completa) a la que se le van a poner las horas en 0.
  const [rowsToClear, setRowsToClear] = useState<ProjectGridRow[] | null>(null)
  // Alta/edición/baja de proyectos sin salir de la grilla: al repartir horas
  // es cuando uno se da cuenta de que falta un proyecto o que sobra otro, y
  // hasta ahora había que irse a /proyectos y volver.
  const [projectFormOpen, setProjectFormOpen] = useState(false)
  // Con qué categoría abre el formulario al crear desde la sábana: "Crear un
  // emergente" es una acción propia, no un campo que haya que acordarse de
  // cambiar dentro del diálogo.
  const [newProjectCategory, setNewProjectCategory] = useState<ProjectCategory>("proyecto")
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  // Alta/renombre de una línea: un mismo diálogo para las dos acciones,
  // igual que ProjectFormDialog resuelve crear/editar. `projectId` es a qué
  // proyecto se le agrega; `line` es la que se está renombrando.
  const [lineDialog, setLineDialog] = useState<
    { projectId: string; line: ProjectLine | null } | null
  >(null)
  const [lineToDelete, setLineToDelete] = useState<ProjectGridRow | null>(null)
  const lineById = useMemo(() => {
    const map = new Map<string, ProjectLine>()
    for (const line of lines ?? []) map.set(line.id, line)
    return map
  }, [lines])
  // Proyectos sumados a la grilla de este mes que aún no tienen horas. Se
  // guardan por mes para que cambiar de mes no arrastre filas vacías ajenas.
  const [extraByMonth, setExtraByMonth] = useState<Record<string, string[]>>({})
  const extraProjectIds = useMemo(
    () => new Set(extraByMonth[activeMonthId ?? ""] ?? []),
    [extraByMonth, activeMonthId]
  )
  const addProjectToMonth = (projectId: string) =>
    setExtraByMonth((prev) => {
      const key = activeMonthId ?? ""
      const current = prev[key] ?? []
      // Defensa contra doble clic o una relectura del menú antes de que el
      // estado se refresque: sin esto, dos disparos del mismo id apilarían
      // el mismo proyecto dos veces en el arreglo (aunque el Set derivado lo
      // deduplique para pintar la fila, sigue siendo estado sucio).
      if (current.includes(projectId)) return prev
      return { ...prev, [key]: [...current, projectId] }
    })
  const deleteProject = useDeleteProject()
  const { data: managers } = useProjectManagers()
  const { data: members } = useProjectMembers()

  const activePosition = useRef<{ rowIdx: number; columnKey: string } | null>(null)

  // El Analista de Tecnología no entra en el reparto de horas del mes, así
  // que tampoco ocupa columna en la grilla — mismo criterio que el Dashboard.
  const excludedPersonIds = usePlanningExclusions(activeMonthId)

  const visiblePeople = useMemo(
    () =>
      [...(people ?? [])]
        .filter((person) => !excludedPersonIds.has(person.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [people, excludedPersonIds]
  )

  // Cruces de fechas de entrega: mismo cálculo que en Cronograma
  // (findDueDateConflicts), pero acá se hace por persona y se juntan todos
  // en un solo aviso — es al repartir horas y armar tareas cuando conviene
  // verlo, no solo después en el cronograma de cada quien.
  const { data: monthTasks } = useTasks(activeMonthId)
  const { data: monthTaskAssignees } = useTaskAssignees(activeMonthId)
  const assigneeIdsByTask = useMemo(
    () => buildAssigneeIdsByTask(monthTaskAssignees ?? []),
    [monthTaskAssignees]
  )
  const dueDateConflicts = useMemo(() => {
    const results: { personName: string; taskA: string; taskB: string; date: string }[] = []
    for (const person of visiblePeople) {
      const personTasks = (monthTasks ?? []).filter((t) =>
        (assigneeIdsByTask.get(t.id) ?? []).includes(person.id)
      )
      for (const conflict of findDueDateConflicts(personTasks)) {
        results.push({
          personName: person.name,
          taskA: conflict.taskA.title,
          taskB: conflict.taskB.title,
          date: conflict.taskA.endIso,
        })
      }
    }
    return results
  }, [visiblePeople, monthTasks, assigneeIdsByTask])

  // Los proyectos son durables, pero la sábana es de un mes: la grilla trae
  // los que consumen horas en el mes activo. `extraProjectIds` deja meter
  // uno que todavía no tiene ninguna — apenas se le escriba una hora se
  // sostiene solo, y si no, desaparece al recargar (no queda basura).
  const monthProjectIds = useMemo(
    () => new Set((allocations ?? []).map((a) => a.project_id)),
    [allocations]
  )

  const visibleProjects = useMemo(
    () =>
      sortActiveProjectsFirst(
        (projects ?? []).filter(
          (p) =>
            p.status !== "archivado" && (monthProjectIds.has(p.id) || extraProjectIds.has(p.id))
        )
      ),
    [projects, monthProjectIds, extraProjectIds]
  )

  // Para el menú de "agregar al mes": todo el portafolio activo, esté o no
  // ya en la grilla. Antes se escondía lo que ya estaba, con la idea de
  // evitar filas repetidas — pero el efecto real era que un proyecto se
  // "perdía" del menú apenas se le tocaban las horas, y no había forma de
  // volver a encontrarlo ahí si hacía falta (por ejemplo, para confirmar que
  // sigue sumado al mes). Reagregarlo es inofensivo: el proyecto ya tiene
  // una sola fila (`visibleProjects` es un OR, no puede duplicarla) y
  // `addProjectToMonth` no hace nada si el id ya está anotado.
  //
  // Los emergentes van en su propio grupo y no mezclados entre los proyectos:
  // son trabajo que apareció sin planear, suelen ser muchos y de nombre
  // parecido, y enterraban al portafolio en la lista. Se ordenan del más
  // viejo al más nuevo — el orden en que fueron apareciendo.
  const addable = useMemo(() => {
    const disponibles = (projects ?? []).filter((p) => p.status !== "archivado")
    return {
      proyectos: disponibles
        .filter((p) => p.category !== "emergente")
        .sort((a, b) => a.name.localeCompare(b.name)),
      emergentes: disponibles
        .filter((p) => p.category === "emergente")
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }
  }, [projects])

  // Para marcar en el menú los que ya tienen fila en el mes — visible, pero
  // ya no oculto ni bloqueado.
  const enLaGrilla = useMemo(
    () => new Set([...monthProjectIds, ...extraProjectIds]),
    [monthProjectIds, extraProjectIds]
  )

  const allRows = useMemo(
    () => buildProjectGridRows(visibleProjects, lines ?? [], allocations ?? []),
    [visibleProjects, lines, allocations]
  )

  const personSummaries = useMemo(
    () => buildPersonSummaries(people ?? [], allocations ?? []),
    [people, allocations]
  )
  const summaryByPerson = useMemo(() => {
    const map = new Map<string, PersonSummary>()
    for (const s of personSummaries) map.set(s.personId, s)
    return map
  }, [personSummaries])

  const rowTotals = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of allRows) {
      map.set(
        row.rowKey,
        Object.values(row.hours).reduce((sum, h) => sum + h, 0)
      )
    }
    return map
  }, [allRows])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q ? allRows.filter((r) => r.name.toLowerCase().includes(q)) : allRows
    const sorted = [...filtered].sort((a, b) => {
      const cmp =
        sortField === "name"
          ? a.name.localeCompare(b.name)
          : (rowTotals.get(a.rowKey) ?? 0) - (rowTotals.get(b.rowKey) ?? 0)
      return sortDir === "asc" ? cmp : -cmp
    })
    return sorted
  }, [allRows, search, sortField, sortDir, rowTotals])

  // "Libres" es la resta que faltaba: disponibles menos lo ya planeado. Antes
  // "Disponible" era la única cifra de capacidad, pero es un campo EDITABLE
  // (ahí se ajustan las horas del mes de cada quien) — no puede a la vez
  // mostrar el resultado de restarle lo planeado sin dejar de ser un input.
  // "Libres" es de solo lectura y sí hace esa cuenta.
  const summaryRows = useMemo<SummaryRow[]>(
    () => [{ id: "total" }, { id: "disponible" }, { id: "libres" }],
    []
  )

  // Índice celda → allocation, para saber qué filas de la base tocar al
  // limpiar sin recorrer el arreglo entero por cada celda. Misma llave
  // persona+proyecto+línea que usan activitiesByCell/commentsByCell: dos
  // filas del mismo proyecto (base y una línea) son celdas distintas.
  const allocationIdByCell = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of allocations ?? [])
      map.set(cellKey(a.person_id, a.project_id, a.line_id), a.id)
    return map
  }, [allocations])

  // Qué se limpia de verdad: las celdas con desglose de actividades quedan
  // fuera, porque ahí las horas las calcula el trigger que suma actividades y
  // ponerlas en 0 a mano duraría hasta el siguiente cambio del desglose. Se
  // avisa cuántas quedan sin tocar en la confirmación.
  const clearPlanFor = (targets: ProjectGridRow[]) => {
    const ids: string[] = []
    let skipped = 0
    for (const row of targets) {
      for (const person of visiblePeople) {
        const key = cellKey(person.id, row.projectId, row.lineId)
        const allocationId = allocationIdByCell.get(key)
        if (!allocationId) continue
        if ((activitiesByCell.get(key) ?? []).length > 0) {
          if ((row.hours[person.id] ?? 0) > 0) skipped += 1
          continue
        }
        if ((row.hours[person.id] ?? 0) === 0) continue
        ids.push(allocationId)
      }
    }
    return { ids, skipped }
  }

  const clearPlan = rowsToClear ? clearPlanFor(rowsToClear) : null

  const columns = useMemo<Column<ProjectGridRow, SummaryRow>[]>(() => {
    const linesByProjectId = new Map<string, ProjectLine[]>()
    for (const line of lines ?? []) {
      const list = linesByProjectId.get(line.project_id) ?? []
      list.push(line)
      linesByProjectId.set(line.project_id, list)
    }

    const projectCol: Column<ProjectGridRow, SummaryRow> = {
      key: "name",
      name: "Proyecto",
      frozen: true,
      width: 200,
      resizable: true,
      renderCell: ({ row }) => (
        <div className="group/proj flex h-full items-center gap-2 py-1 leading-tight" title={row.name}>
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
          <span className="line-clamp-2 min-w-0 flex-1 whitespace-normal font-medium">
            {row.name}
          </span>
          {/* El menú vive en la columna congelada para que siga a la vista
              por más que se desplace la grilla a lo ancho. Aparece al pasar
              el mouse (o al enfocarlo con el teclado) para no meter un ícono
              fijo en cada una de las filas. Son acciones del PROYECTO
              completo — renombrar/borrar el subproyecto de esta fila vive en
              su propia columna. */}
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Acciones de ${row.name}`}
                  className="shrink-0 opacity-0 transition-opacity group-hover/proj:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setRowsToClear([row])}>
                  <Eraser /> Limpiar horas de la fila
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLineDialog({ projectId: row.projectId, line: null })}
                >
                  <Layers /> Agregar subproyecto
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const project = visibleProjects.find((p) => p.id === row.projectId)
                    if (project) setEditingProject(project)
                  }}
                >
                  <Pencil /> Editar proyecto
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    const project = visibleProjects.find((p) => p.id === row.projectId)
                    if (project) setProjectToDelete(project)
                  }}
                >
                  <Trash2 /> Eliminar proyecto
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      ),
      renderSummaryCell: ({ row }) => (
        <div className="flex h-full items-center px-2 text-sm font-semibold">
          {row.id === "total" ? "Total" : row.id === "disponible" ? "Disponible" : "Libres"}
        </div>
      ),
    }

    // Todo proyecto tiene al menos un subproyecto (obligatorio, con su mismo
    // nombre por defecto) — ver *_subproyecto_obligatorio.sql. Esta columna
    // es la que distingue las filas de un mismo proyecto cuando tiene más de
    // uno; para el caso normal (un solo subproyecto) simplemente repite el
    // nombre del proyecto, que es justo lo que se pidió.
    const subprojectCol: Column<ProjectGridRow, SummaryRow> = {
      key: "subproject",
      name: "Subproyecto",
      frozen: true,
      width: 160,
      resizable: true,
      renderCell: ({ row }) => {
        const isOnlyLine = (linesByProjectId.get(row.projectId)?.length ?? 1) <= 1
        return (
          <div className="group/sub flex h-full items-center gap-1 py-1 leading-tight">
            <span className="line-clamp-2 min-w-0 flex-1 whitespace-normal text-sm text-muted-foreground">
              {row.subprojectName}
            </span>
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Acciones de ${row.subprojectName}`}
                    className="shrink-0 opacity-0 transition-opacity group-hover/sub:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={() =>
                      setLineDialog({
                        projectId: row.projectId,
                        line: lineById.get(row.lineId) ?? null,
                      })
                    }
                  >
                    <Pencil /> Renombrar subproyecto
                  </DropdownMenuItem>
                  {!isOnlyLine && (
                    <DropdownMenuItem variant="destructive" onClick={() => setLineToDelete(row)}>
                      <Trash2 /> Eliminar subproyecto
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )
      },
      renderSummaryCell: () => null,
    }

    const personCols: Column<ProjectGridRow, SummaryRow>[] = visiblePeople.map((person) => ({
      key: person.id,
      name: person.name,
      width: 120,
      resizable: true,
      editable: (row) =>
        canEdit &&
        (activitiesByCell.get(cellKey(person.id, row.projectId, row.lineId)) ?? []).length === 0,
      renderHeaderCell: () => (
        <div className="flex h-full w-full flex-col items-center justify-center px-1 text-center text-xs font-semibold leading-tight">
          <span className="line-clamp-2 whitespace-normal">{person.name}</span>
        </div>
      ),
      renderCell: ({ row }) => {
        const value = row.hours[person.id] ?? 0
        const key = cellKey(person.id, row.projectId, row.lineId)
        const cellComments = commentsByCell.get(key) ?? []
        const hasComments = cellComments.length > 0
        const cellActivities = activitiesByCell.get(key) ?? []
        const hasActivities = cellActivities.length > 0
        const marks = cellActivities.length + cellComments.length
        // Un solo acceso al detalle de la celda. Abre en la pestaña de lo que
        // ya tiene contenido (o en Actividades, que es lo que más se usa
        // mientras se reparten horas).
        const initialTab: CellTab =
          cellActivities.length === 0 && hasComments ? "comentarios" : "actividades"
        const openDetail = () =>
          setDetailCell({
            personId: person.id,
            projectId: row.projectId,
            lineId: row.lineId,
            tab: initialTab,
          })
        return (
          <div
            className="relative flex h-full items-center justify-end px-2 tabular-nums"
            style={{ backgroundColor: tintBackground(row.color) }}
            // Cualquier clic en la celda abre el detalle (actividades /
            // tareas) — no hace falta apuntarle al iconito. No interfiere con
            // la edición de horas: react-data-grid solo entra a editar con
            // doble clic, Enter o al empezar a escribir, no con un clic.
            onClick={openDetail}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "absolute left-1 top-1 flex items-center gap-0.5 rounded-full px-0.5 text-xs leading-none font-medium",
                    marks > 0 ? "text-primary" : "text-muted-foreground/60"
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    openDetail()
                  }}
                  aria-label="Detalle de la celda: actividades y comentarios"
                >
                  <NotebookText className="size-4" />
                  {marks > 0 && <span>{marks}</span>}
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-56">
                <p className="text-xs">
                  {marks === 0
                    ? "Detalle de la celda: desglosar horas en actividades o comentar."
                    : `${cellActivities.length} actividad${
                        cellActivities.length === 1 ? "" : "es"
                      } · ${cellComments.length} comentario${
                        cellComments.length === 1 ? "" : "s"
                      }`}
                </p>
                {hasComments && (
                  <p className="mt-1 text-xs opacity-80">
                    “{cellComments[cellComments.length - 1].body}”
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
            {hasActivities && (
              <span
                aria-hidden
                title="Horas calculadas desde el desglose de actividades"
                className="absolute bottom-1 left-1 h-0.5 w-3 rounded-full bg-primary/60"
              />
            )}
            {value > 0 ? value : ""}
          </div>
        )
      },
      renderEditCell: canEdit ? (props) => <HoursEditCell {...props} /> : undefined,
      renderSummaryCell: ({ row }) => {
        const summary = summaryByPerson.get(person.id)
        if (!summary) return null
        if (row.id === "disponible") {
          // Las horas disponibles se editan acá, que es donde se miran: son el
          // denominador del semáforo. Antes vivían en el módulo Personas, a
          // dos pantallas de distancia del único lugar donde significan algo.
          return (
            <AvailableHoursCell
              personId={person.id}
              personName={person.name}
              hours={summary.availableHours}
              canEdit={canEdit}
              onSave={(hours) =>
                updatePerson.mutate({ id: person.id, patch: { available_hours: hours } })
              }
            />
          )
        }
        if (row.id === "libres") {
          // La resta que faltaba: disponibles menos lo ya repartido. Negativo
          // = sobreasignada (rojo, mismo caso que el Total en rojo); positivo
          // = todavía hay margen (amarillo, igual que "Total" cuando falta
          // repartir); cero = exacto. Es el mismo statusColor de la fila
          // "Total" — es la misma comparación, solo que aquí se ve el
          // resultado de la resta en vez del acumulado.
          const remaining = summary.availableHours - summary.totalHours
          return (
            <div
              className={cn(
                "flex h-full items-center justify-end px-2 font-semibold tabular-nums",
                STATUS_CLASS[summary.statusColor]
              )}
              title={`${summary.availableHours} disponibles − ${summary.totalHours} planeadas`}
            >
              {remaining > 0 ? `+${remaining}` : remaining}
            </div>
          )
        }
        return (
          <div
            className={cn(
              "flex h-full items-center justify-end px-2 font-semibold tabular-nums",
              STATUS_CLASS[summary.statusColor]
            )}
          >
            {summary.totalHours}
          </div>
        )
      },
    }))

    return [projectCol, subprojectCol, ...personCols]
  }, [
    visiblePeople,
    visibleProjects,
    lines,
    lineById,
    canEdit,
    commentsByCell,
    activitiesByCell,
    summaryByPerson,
    updatePerson,
  ])

  const personIdAtColumnOffset = (anchorColumnKey: string, offset: number): string | null => {
    const idx = visiblePeople.findIndex((p) => p.id === anchorColumnKey)
    if (idx === -1) return null
    return visiblePeople[idx + offset]?.id ?? null
  }

  const handleRowsChange = (
    changedRows: ProjectGridRow[],
    { indexes, column }: { indexes: number[]; column: { key: string } }
  ) => {
    if (!activeMonthId) return
    for (const idx of indexes) {
      const row = changedRows[idx]
      const hours = row.hours[column.key] ?? 0
      upsertAllocation.mutate({
        personId: column.key,
        projectId: row.projectId,
        lineId: row.lineId,
        hours,
      })
    }
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (!canEdit || !activeMonthId) return
    const anchor = activePosition.current
    if (!anchor) return
    const text = event.clipboardData.getData("text/plain")
    if (!text) return
    const isPersonColumn = visiblePeople.some((p) => p.id === anchor.columnKey)
    if (!isPersonColumn) return

    event.preventDefault()
    const lines = text.replace(/\r/g, "").split("\n")
    while (lines.length > 1 && lines[lines.length - 1] === "") lines.pop()

    lines.forEach((line, rowOffset) => {
      const targetRow = rows[anchor.rowIdx + rowOffset]
      if (!targetRow) return
      line.split("\t").forEach((rawValue, colOffset) => {
        const personId =
          colOffset === 0 ? anchor.columnKey : personIdAtColumnOffset(anchor.columnKey, colOffset)
        if (!personId) return
        const parsed = Number(rawValue.replace(",", ".").trim())
        if (!Number.isFinite(parsed) || parsed < 0) return
        upsertAllocation.mutate({
          personId,
          projectId: targetRow.projectId,
          lineId: targetRow.lineId,
          hours: parsed,
        })
      })
    })
  }

  const handleActivePositionChange = (args: PositionChangeArgs<ProjectGridRow, SummaryRow>) => {
    activePosition.current = args.column ? { rowIdx: args.rowIdx, columnKey: args.column.key } : null
  }

  const isLoading = loadingPeople || loadingProjects || loadingAllocations

  if (!activeMonthId) return <NoActiveMonth />

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={Grid3x3}
        eyebrow="Planeación"
        title="Sábana"
        description={
          canEdit
            ? "Edita horas directamente en la grilla. Se guardan automáticamente."
            : "Modo de solo lectura — tu rol puede consultar y comentar, no editar horas."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Píldoras del sistema (§11.9): borde de 1.5px sobre superficie,
                texto de apoyo y el punto de color como portador del estado. */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5 rounded-full border-[1.5px] border-border bg-card px-2.5 py-1">
                <span className="size-2 rounded-full bg-success" /> Exacto
              </span>
              <span className="flex items-center gap-1.5 rounded-full border-[1.5px] border-border bg-card px-2.5 py-1">
                <span className="size-2 rounded-full bg-warning" /> Faltan horas
              </span>
              <span className="flex items-center gap-1.5 rounded-full border-[1.5px] border-border bg-card px-2.5 py-1">
                <span className="size-2 rounded-full bg-danger" /> De más
              </span>
            </div>
            {/* Un solo acceso para sumar filas a la grilla: primero lo que ya
                existe (el caso normal — el proyecto se creó en otro mes o en
                el módulo Proyectos) y al final crear uno nuevo. Antes eran
                dos controles separados y en dos zonas distintas de la
                pantalla, así que se creaban proyectos duplicados sin ver que
                el original ya estaba a un clic. */}
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="btn-press">
                    <Plus /> Agregar proyecto
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-96 w-72 overflow-y-auto">
                  <DropdownMenuLabel className="text-eyebrow text-muted-foreground">
                    Proyectos
                  </DropdownMenuLabel>
                  {addable.proyectos.length === 0 ? (
                    <p className="px-2 py-1.5 text-sm text-muted-foreground">
                      No hay proyectos creados todavía.
                    </p>
                  ) : (
                    addable.proyectos.map((project) => {
                      const yaEstá = enLaGrilla.has(project.id)
                      return (
                        <DropdownMenuItem
                          key={project.id}
                          onClick={() => addProjectToMonth(project.id)}
                          title={yaEstá ? "Ya está en este mes — puedes agregarlo de nuevo si lo necesitas." : undefined}
                        >
                          <span
                            aria-hidden
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          <span className={cn("truncate", yaEstá && "text-muted-foreground")}>
                            {project.name}
                          </span>
                          {yaEstá && <Check aria-hidden className="ml-auto size-3.5 shrink-0 text-success" />}
                        </DropdownMenuItem>
                      )
                    })
                  )}
                  <DropdownMenuSeparator />
                  {/* Los emergentes van aparte: no compiten con el portafolio
                      en la lista de arriba, del más viejo al más nuevo. */}
                  <DropdownMenuLabel className="text-eyebrow text-muted-foreground">
                    Emergentes
                  </DropdownMenuLabel>
                  {addable.emergentes.length === 0 ? (
                    <p className="px-2 py-1.5 text-sm text-muted-foreground">
                      No hay emergentes creados todavía.
                    </p>
                  ) : (
                    addable.emergentes.map((project) => {
                      const yaEstá = enLaGrilla.has(project.id)
                      return (
                        <DropdownMenuItem
                          key={project.id}
                          onClick={() => addProjectToMonth(project.id)}
                          title={yaEstá ? "Ya está en este mes — puedes agregarlo de nuevo si lo necesitas." : undefined}
                        >
                          <span
                            aria-hidden
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          <span className={cn("truncate", yaEstá && "text-muted-foreground")}>
                            {project.name}
                          </span>
                          {yaEstá && <Check aria-hidden className="ml-auto size-3.5 shrink-0 text-success" />}
                        </DropdownMenuItem>
                      )
                    })
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-primary"
                    onClick={() => {
                      setEditingProject(null)
                      setNewProjectCategory("proyecto")
                      setProjectFormOpen(true)
                    }}
                  >
                    <Plus /> Crear un proyecto nuevo
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-primary"
                    onClick={() => {
                      setEditingProject(null)
                      setNewProjectCategory("emergente")
                      setProjectFormOpen(true)
                    }}
                  >
                    <Zap /> Crear un emergente
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        }
      />

      {/* Mientras el mes no esté liberado, el equipo no lo ve: es la ventana
          para armar la sábana sin que nadie trabaje sobre algo que va a
          cambiar. Solo lo ven quienes lo preparan (Gestor/Administrador), que
          son los únicos que pueden estar aquí con el mes sin liberar. */}
      {activeMonth?.released_at === null && (
        <div className="animate-fade-in flex flex-wrap items-start gap-3 rounded-xl border border-border bg-accent/60 p-3.5 text-sm">
          {activeMonth.planning_ready_at ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
          ) : (
            <EyeOff className="mt-0.5 size-4 shrink-0 text-primary" />
          )}
          <span className="min-w-56 flex-1">
            <strong>{activeMonth.name}</strong>{" "}
            {activeMonth.planning_ready_at ? (
              <>
                está marcado como <strong>planeación lista</strong>. El administrador ya puede
                liberarlo al equipo; mientras tanto sigues pudiendo ajustar las horas.
              </>
            ) : (
              <>
                está en preparación: el equipo todavía no lo ve. Reparte las horas y carga las
                actividades, y cuando esté armado avísale al administrador con el botón.
              </>
            )}
          </span>
          {isGestorOrAdmin(profile?.role) && !monthLocked && (
            <Button
              variant={activeMonth.planning_ready_at ? "ghost" : "default"}
              size="sm"
              disabled={setPlanningReady.isPending}
              onClick={() =>
                setPlanningReady.mutate({
                  monthId: activeMonth.id,
                  ready: !activeMonth.planning_ready_at,
                })
              }
            >
              <CheckCircle2 />
              {activeMonth.planning_ready_at ? "Quitar la marca" : "Planeación lista"}
            </Button>
          )}
        </div>
      )}

      {monthLocked && !isAdmin(profile?.role) && (
        <div className="animate-fade-in flex items-start gap-3 rounded-xl border border-border bg-muted/60 p-3.5 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>
            <strong>{activeMonth?.name}</strong> está cerrado, así que sus horas quedaron
            congeladas y la grilla es de solo lectura. Las tareas del mes sí se pueden seguir
            trabajando desde el tablero.
          </span>
        </div>
      )}

      <div className="filter-bar">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar proyecto…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Ordenar por nombre</SelectItem>
            <SelectItem value="total">Ordenar por horas totales</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          aria-label="Cambiar dirección de orden"
        >
          {sortDir === "asc" ? <ArrowUpNarrowWide /> : <ArrowDownWideNarrow />}
        </Button>
        {canEdit && rows.length > 0 && (
          <Button
            variant="outline"
            onClick={() => setRowsToClear(rows)}
            title="Poner en 0 las horas de las filas que se ven ahora"
          >
            <Eraser /> Limpiar horas
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : visiblePeople.length === 0 ? (
        // Las columnas de la grilla son el equipo del MES, no el de un
        // proyecto: sin roster no hay a quién repartirle horas. El mensaje lo
        // dice explícito porque "no hay personas" se leía como si faltara
        // asignar gente a los proyectos — que es justo al revés, la
        // pertenencia al proyecto nace de repartirle horas aquí.
        <EmptyState
          icon={Users}
          title="Este mes todavía no tiene equipo"
          description="La grilla pone una columna por cada cuenta activa. Trae el equipo —los meses nuevos ya lo hacen solos— y reparte: al escribirle horas a alguien queda vinculado a ese proyecto automáticamente. Si falta alguien, actívale la cuenta en Configuración › Usuarios."
          action={
            isGestorOrAdmin(profile?.role) ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  onClick={() => seedPeople.mutate()}
                  disabled={seedPeople.isPending}
                >
                  <UserPlus /> Traer el equipo del mes anterior
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {dueDateConflicts.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-md border border-warning/40 bg-warning-muted px-3 py-2 text-sm text-warning">
              <p className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="size-4 shrink-0" />
                {dueDateConflicts.length === 1
                  ? "Hay 2 tareas con fechas de entrega cruzadas"
                  : `Hay ${dueDateConflicts.length} cruces de fechas de entrega`}
              </p>
              <ul className="ml-6 list-disc">
                {dueDateConflicts.map((c, i) => (
                  <li key={i}>
                    {c.personName}: “{c.taskA}” y “{c.taskB}” ({c.date})
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div onPaste={handlePaste} className="overflow-hidden rounded-md border border-border">
            <DataGrid
              className="sabana-grid"
              columns={columns}
              rows={rows}
              rowKeyGetter={(row) => row.rowKey}
              onRowsChange={handleRowsChange}
              bottomSummaryRows={summaryRows}
              onFill={({ columnKey, sourceRow, targetRow }) => ({
                ...targetRow,
                hours: { ...targetRow.hours, [columnKey]: sourceRow.hours[columnKey] ?? 0 },
              })}
              onActivePositionChange={handleActivePositionChange}
              rowHeight={48}
              headerRowHeight={44}
              summaryRowHeight={36}
              style={{ blockSize: "min(70svh, 640px)" }}
            />
          </div>
        </div>
      )}

      {detailCell &&
        activeMonthId &&
        (() => {
          const person = visiblePeople.find((p) => p.id === detailCell.personId)
          // El nombre de la fila (con línea, si aplica) sale de la fila
          // misma, no del proyecto: "Editar proyecto" y "Detalle de celda"
          // necesitan textos distintos para la misma persona/proyecto si hay
          // una línea de por medio.
          const row = allRows.find(
            (r) => r.rowKey === rowKeyFor(detailCell.projectId, detailCell.lineId)
          )
          if (!person || !row) return null
          const key = cellKey(detailCell.personId, detailCell.projectId, detailCell.lineId)
          const displayName =
            row.subprojectName === row.name ? row.name : `${row.name} — ${row.subprojectName}`
          return (
            <CellDetailsDialog
              open
              onOpenChange={(open) => !open && setDetailCell(null)}
              initialTab={detailCell.tab}
              monthId={activeMonthId}
              personId={detailCell.personId}
              projectId={detailCell.projectId}
              lineId={detailCell.lineId}
              personName={person.name}
              projectName={displayName}
              comments={commentsByCell.get(key) ?? []}
              activities={activitiesByCell.get(key) ?? []}
              readOnly={!canEdit}
            />
          )
        })()}

      <ConfirmDialog
        open={Boolean(rowsToClear)}
        onOpenChange={(open) => !open && setRowsToClear(null)}
        title={
          rowsToClear && rowsToClear.length === 1
            ? `Limpiar las horas de "${rowsToClear[0].name}"`
            : `Limpiar las horas de ${rowsToClear?.length ?? 0} proyectos`
        }
        description={
          clearPlan && clearPlan.ids.length === 0
            ? clearPlan.skipped > 0
              ? "No hay nada que limpiar: las únicas celdas con horas vienen de un desglose de actividades, y esas se vacían borrando sus actividades."
              : "No hay horas que limpiar en esta selección."
            : `Se pondrán en 0 las horas de ${clearPlan?.ids.length ?? 0} celda${
                clearPlan?.ids.length === 1 ? "" : "s"
              }. Los proyectos siguen en el mes, y sus comentarios y actividades no se tocan.${
                clearPlan && clearPlan.skipped > 0
                  ? ` ${clearPlan.skipped} celda${
                      clearPlan.skipped === 1 ? " queda" : "s quedan"
                    } sin cambios porque sus horas salen de un desglose de actividades.`
                  : ""
              }`
        }
        confirmLabel={clearPlan && clearPlan.ids.length === 0 ? "Entendido" : "Limpiar"}
        onConfirm={async () => {
          if (clearPlan && clearPlan.ids.length > 0) {
            await clearAllocations.mutateAsync(clearPlan.ids)
          }
          setRowsToClear(null)
        }}
      />

      {activeMonthId && (
        <ProjectFormDialog
          // Crear y editar comparten diálogo: `editingProject` decide cuál
          // de los dos es. Se abre cuando hay proyecto en edición o cuando
          // el botón de alta puso el flag.
          open={projectFormOpen || Boolean(editingProject)}
          onOpenChange={(open) => {
            if (!open) {
              setProjectFormOpen(false)
              setEditingProject(null)
            }
          }}
          // Un proyecto creado desde acá se espera ver en la grilla ya, aunque
          // todavía no tenga horas repartidas.
          defaultCategory={newProjectCategory}
          onSaved={(saved) => addProjectToMonth(saved.id)}
          project={editingProject}
          people={people ?? []}
          currentManager={managers?.find((m) => m.project_id === editingProject?.id)}
          currentMemberIds={(members ?? [])
            .filter((m) => m.project_id === editingProject?.id)
            .map((m) => m.person_id)}
        />
      )}

      <ConfirmDialog
        open={Boolean(projectToDelete)}
        onOpenChange={(open) => !open && setProjectToDelete(null)}
        title={`Eliminar "${projectToDelete?.name}"`}
        description="Se eliminarán también sus asignaciones de horas, tareas y comentarios asociados."
        onConfirm={async () => {
          if (projectToDelete) await deleteProject.mutateAsync(projectToDelete.id)
          setProjectToDelete(null)
        }}
      />

      <ProjectLineFormDialog
        open={Boolean(lineDialog)}
        onOpenChange={(open) => !open && setLineDialog(null)}
        line={lineDialog?.line ?? null}
        onSubmit={async (name) => {
          if (!lineDialog) return
          if (lineDialog.line) {
            await renameLine.mutateAsync({ id: lineDialog.line.id, name })
          } else {
            await createLine.mutateAsync({ projectId: lineDialog.projectId, name })
          }
          setLineDialog(null)
        }}
      />

      <ConfirmDialog
        open={Boolean(lineToDelete)}
        onOpenChange={(open) => !open && setLineToDelete(null)}
        title={`Eliminar "${lineToDelete?.subprojectName}"`}
        description="Se eliminan las horas repartidas en este subproyecto, sus actividades y sus comentarios. El proyecto y sus demás subproyectos no se tocan."
        onConfirm={async () => {
          if (lineToDelete?.lineId) await deleteLine.mutateAsync(lineToDelete.lineId)
          setLineToDelete(null)
        }}
      />
    </div>
  )
}
