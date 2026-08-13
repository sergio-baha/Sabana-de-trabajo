import { useMemo, useRef, useState } from "react"
import { DataGrid, type Column, type PositionChangeArgs } from "react-data-grid"
import "react-data-grid/lib/styles.css"
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Eraser,
  Grid3x3,
  Lock,
  MoreHorizontal,
  NotebookText,
  Pencil,
  Plus,
  Search,
  Trash2,
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
import PageHeader from "@/components/shared/PageHeader"
import { usePeople } from "@/features/people/hooks/usePeopleQueries"
import { useMonths } from "@/features/months/hooks/useMonthsQueries"
import { usePlanningExclusions } from "@/features/people/hooks/usePlanningExclusions"
import {
  useDeleteProject,
  useProjectManagers,
  useProjectMembers,
  useProjects,
} from "@/features/projects/hooks/useProjectsQueries"
import type { Project } from "@/features/projects/api/projectsApi"
import ProjectFormDialog from "@/features/projects/components/ProjectFormDialog"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  sortActiveProjectsFirst,
  type PersonSummary,
  type ProjectGridRow,
  type SummaryRow,
} from "@/features/grid/lib/gridRows"
import { tintBackground } from "@/features/grid/lib/colorContrast"
import HoursEditCell from "@/features/grid/components/HoursEditCell"
import { useCommentsByCell, useRealtimeComments } from "@/features/comments/hooks/useCommentsQueries"
import {
  useActivitiesByCell,
  useRealtimeActivities,
} from "@/features/activities/hooks/useActivitiesQueries"
import CellDetailsDialog, { type CellTab } from "@/features/grid/components/CellDetailsDialog"
import { useActiveMonthStore } from "@/stores/activeMonthStore"
import { useSessionStore } from "@/stores/sessionStore"
import { isAdmin, isGestorOrAdmin } from "@/lib/roles"
import { cn } from "@/lib/utils"

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
  const canEdit = isGestorOrAdmin(profile?.role) && (!monthLocked || isAdmin(profile?.role))

  const { data: people, isLoading: loadingPeople } = usePeople(activeMonthId)
  const { data: projects, isLoading: loadingProjects } = useProjects()
  const { data: allocations, isLoading: loadingAllocations } = useAllocations(activeMonthId)
  const upsertAllocation = useUpsertAllocation(activeMonthId ?? "")
  const clearAllocations = useClearAllocations(activeMonthId ?? "")
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
    tab: CellTab
  } | null>(null)
  // Fila (o grilla completa) a la que se le van a poner las horas en 0.
  const [rowsToClear, setRowsToClear] = useState<ProjectGridRow[] | null>(null)
  // Alta/edición/baja de proyectos sin salir de la grilla: al repartir horas
  // es cuando uno se da cuenta de que falta un proyecto o que sobra otro, y
  // hasta ahora había que irse a /proyectos y volver.
  const [projectFormOpen, setProjectFormOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
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
      return { ...prev, [key]: [...(prev[key] ?? []), projectId] }
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

  // Para el selector de "agregar al mes": lo que existe y todavía no está.
  const addableProjects = useMemo(
    () =>
      (projects ?? [])
        .filter(
          (p) =>
            p.status !== "archivado" && !monthProjectIds.has(p.id) && !extraProjectIds.has(p.id)
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [projects, monthProjectIds, extraProjectIds]
  )

  const allRows = useMemo(
    () => buildProjectGridRows(visibleProjects, allocations ?? []),
    [visibleProjects, allocations]
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
        row.projectId,
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
          : (rowTotals.get(a.projectId) ?? 0) - (rowTotals.get(b.projectId) ?? 0)
      return sortDir === "asc" ? cmp : -cmp
    })
    return sorted
  }, [allRows, search, sortField, sortDir, rowTotals])

  const summaryRows = useMemo<SummaryRow[]>(() => [{ id: "total" }, { id: "disponible" }], [])

  // Índice celda → allocation, para saber qué filas de la base tocar al
  // limpiar sin recorrer el arreglo entero por cada celda.
  const allocationIdByCell = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of allocations ?? []) map.set(`${a.person_id}:${a.project_id}`, a.id)
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
        const key = `${person.id}:${row.projectId}`
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
    const projectCol: Column<ProjectGridRow, SummaryRow> = {
      key: "name",
      name: "Proyecto",
      frozen: true,
      width: 240,
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
              fijo en cada una de las filas. */}
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
                  <Trash2 /> Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      ),
      renderSummaryCell: ({ row }) => (
        <div className="flex h-full items-center px-2 text-sm font-semibold">
          {row.id === "total" ? "Total" : "Disponible"}
        </div>
      ),
    }

    const personCols: Column<ProjectGridRow, SummaryRow>[] = visiblePeople.map((person) => ({
      key: person.id,
      name: person.name,
      width: 120,
      resizable: true,
      editable: (row) =>
        canEdit && (activitiesByCell.get(`${person.id}:${row.projectId}`) ?? []).length === 0,
      renderHeaderCell: () => (
        <div className="flex h-full w-full flex-col items-center justify-center px-1 text-center text-xs font-semibold leading-tight">
          <span className="line-clamp-2 whitespace-normal">{person.name}</span>
        </div>
      ),
      renderCell: ({ row }) => {
        const value = row.hours[person.id] ?? 0
        const cellComments = commentsByCell.get(`${person.id}:${row.projectId}`) ?? []
        const hasComments = cellComments.length > 0
        const cellActivities = activitiesByCell.get(`${person.id}:${row.projectId}`) ?? []
        const hasActivities = cellActivities.length > 0
        const marks = cellActivities.length + cellComments.length
        // Un solo acceso al detalle de la celda. Abre en la pestaña de lo que
        // ya tiene contenido (o en Actividades, que es lo que más se usa
        // mientras se reparten horas).
        const initialTab: CellTab =
          cellActivities.length === 0 && hasComments ? "comentarios" : "actividades"
        return (
          <div
            className="relative flex h-full items-center justify-end px-2 tabular-nums"
            style={{ backgroundColor: tintBackground(row.color) }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "absolute left-1 top-1 flex items-center gap-0.5 rounded-full px-0.5 text-[10px] leading-none font-medium",
                    marks > 0 ? "text-primary" : "text-muted-foreground/40"
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    setDetailCell({
                      personId: person.id,
                      projectId: row.projectId,
                      tab: initialTab,
                    })
                  }}
                  aria-label="Detalle de la celda: actividades y comentarios"
                >
                  <NotebookText className="size-3" />
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
          return (
            <div className="flex h-full items-center justify-end px-2 tabular-nums text-muted-foreground">
              {summary.availableHours}
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

    return [projectCol, ...personCols]
  }, [
    visiblePeople,
    visibleProjects,
    canEdit,
    commentsByCell,
    activitiesByCell,
    summaryByPerson,
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
      upsertAllocation.mutate({ personId: column.key, projectId: row.projectId, hours })
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
        upsertAllocation.mutate({ personId, projectId: targetRow.projectId, hours: parsed })
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
        title="Distribución"
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
            {canEdit && (
              <Button
                className="btn-press"
                onClick={() => {
                  setEditingProject(null)
                  setProjectFormOpen(true)
                }}
              >
                <Plus /> Nuevo proyecto
              </Button>
            )}
          </div>
        }
      />

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
        {canEdit && addableProjects.length > 0 && (
          <Select value="" onValueChange={addProjectToMonth}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Agregar proyecto al mes…" />
            </SelectTrigger>
            <SelectContent>
              {addableProjects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : visiblePeople.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Agrega al menos una persona a este mes para poder distribuir horas.
        </p>
      ) : (
        <div onPaste={handlePaste} className="overflow-hidden rounded-md border border-border">
          <DataGrid
            className="sabana-grid"
            columns={columns}
            rows={rows}
            rowKeyGetter={(row) => row.projectId}
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
      )}

      {detailCell &&
        activeMonthId &&
        (() => {
          const person = visiblePeople.find((p) => p.id === detailCell.personId)
          const project = visibleProjects.find((p) => p.id === detailCell.projectId)
          if (!person || !project) return null
          const key = `${detailCell.personId}:${detailCell.projectId}`
          return (
            <CellDetailsDialog
              open
              onOpenChange={(open) => !open && setDetailCell(null)}
              initialTab={detailCell.tab}
              monthId={activeMonthId}
              personId={detailCell.personId}
              projectId={detailCell.projectId}
              personName={person.name}
              projectName={project.name}
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
    </div>
  )
}
