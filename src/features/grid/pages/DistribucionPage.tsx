import { useMemo, useRef, useState } from "react"
import { DataGrid, type Column, type PositionChangeArgs } from "react-data-grid"
import "react-data-grid/lib/styles.css"
import { ArrowDownWideNarrow, ArrowUpNarrowWide, MessageSquare, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { usePeople } from "@/features/people/hooks/usePeopleQueries"
import { useProjects } from "@/features/projects/hooks/useProjectsQueries"
import { useAllocations, useUpsertAllocation } from "@/features/grid/hooks/useAllocationsQueries"
import { useRealtimeAllocations } from "@/features/grid/hooks/useRealtimeAllocations"
import { buildGridRows, sortActiveProjectsFirst, type GridRow } from "@/features/grid/lib/gridRows"
import { getContrastText, tintBackground } from "@/features/grid/lib/colorContrast"
import HoursEditCell from "@/features/grid/components/HoursEditCell"
import { useCommentsByCell, useRealtimeComments } from "@/features/comments/hooks/useCommentsQueries"
import CellCommentsDialog from "@/features/comments/components/CellCommentsDialog"
import { useActiveMonthStore } from "@/stores/activeMonthStore"
import { useSessionStore } from "@/stores/sessionStore"
import { isGestorOrAdmin } from "@/lib/roles"
import { cn } from "@/lib/utils"

type SortField = "name" | "total" | "availableHours"

const STATUS_CLASS: Record<GridRow["statusColor"], string> = {
  verde: "bg-success-muted text-success",
  amarillo: "bg-warning-muted text-warning",
  rojo: "bg-danger-muted text-danger",
}

export default function DistribucionPage() {
  const { activeMonthId } = useActiveMonthStore()
  const profile = useSessionStore((s) => s.profile)
  const canEdit = isGestorOrAdmin(profile?.role)

  const { data: people, isLoading: loadingPeople } = usePeople(activeMonthId)
  const { data: projects, isLoading: loadingProjects } = useProjects(activeMonthId)
  const { data: allocations, isLoading: loadingAllocations } = useAllocations(activeMonthId)
  const upsertAllocation = useUpsertAllocation(activeMonthId ?? "")
  useRealtimeAllocations(activeMonthId)
  const { byCell: commentsByCell } = useCommentsByCell(activeMonthId)
  useRealtimeComments(activeMonthId)

  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [commentCell, setCommentCell] = useState<{ personId: string; projectId: string } | null>(
    null
  )

  const activePosition = useRef<{ rowIdx: number; columnKey: string } | null>(null)

  const visibleProjects = useMemo(
    () => sortActiveProjectsFirst((projects ?? []).filter((p) => p.status !== "archivado")),
    [projects]
  )

  const allRows = useMemo(
    () => buildGridRows(people ?? [], allocations ?? []),
    [people, allocations]
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q ? allRows.filter((r) => r.name.toLowerCase().includes(q)) : allRows
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortField === "name") cmp = a.name.localeCompare(b.name)
      else cmp = a[sortField] - b[sortField]
      return sortDir === "asc" ? cmp : -cmp
    })
    return sorted
  }, [allRows, search, sortField, sortDir])

  const columns = useMemo<Column<GridRow>[]>(() => {
    const nameCol: Column<GridRow> = {
      key: "name",
      name: "Persona",
      frozen: true,
      width: 220,
      resizable: true,
      renderCell: ({ row }) => (
        <div className="flex h-full flex-col justify-center py-1 leading-tight">
          <span className="truncate font-medium">{row.name}</span>
          {row.jobTitle && (
            <span className="truncate text-xs text-muted-foreground">{row.jobTitle}</span>
          )}
        </div>
      ),
    }

    const projectCols: Column<GridRow>[] = visibleProjects.map((project) => ({
      key: project.id,
      name: project.name,
      width: 130,
      resizable: true,
      editable: canEdit,
      renderHeaderCell: () => (
        <div
          className="flex h-full w-full items-center justify-center px-2 text-center text-xs font-semibold"
          style={{ backgroundColor: project.color, color: getContrastText(project.color) }}
          title={project.name}
        >
          <span className="truncate">{project.name}</span>
        </div>
      ),
      renderCell: ({ row }) => {
        const value = row.hours[project.id] ?? 0
        const cellComments = commentsByCell.get(`${row.personId}:${project.id}`) ?? []
        const hasComments = cellComments.length > 0
        return (
          <div
            className="relative flex h-full items-center justify-end px-2 tabular-nums"
            style={{ backgroundColor: tintBackground(project.color) }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "absolute left-1 top-1 flex size-4 items-center justify-center rounded-full",
                    hasComments ? "text-primary" : "text-muted-foreground/40"
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    setCommentCell({ personId: row.personId, projectId: project.id })
                  }}
                  aria-label="Comentarios de la celda"
                >
                  <MessageSquare className="size-3" fill={hasComments ? "currentColor" : "none"} />
                </button>
              </TooltipTrigger>
              {hasComments && (
                <TooltipContent className="max-w-56">
                  <p className="text-xs">{cellComments[cellComments.length - 1].body}</p>
                </TooltipContent>
              )}
            </Tooltip>
            {value > 0 ? value : ""}
          </div>
        )
      },
      renderEditCell: canEdit ? (props) => <HoursEditCell {...props} /> : undefined,
    }))

    const totalCol: Column<GridRow> = {
      key: "total",
      name: "Total",
      width: 100,
      renderCell: ({ row }) => (
        <div
          className={cn(
            "flex h-full items-center justify-end px-2 font-semibold tabular-nums",
            STATUS_CLASS[row.statusColor]
          )}
        >
          {row.total}
        </div>
      ),
    }

    const availableCol: Column<GridRow> = {
      key: "availableHours",
      name: "Disponible",
      width: 100,
      renderCell: ({ row }) => (
        <div className="flex h-full items-center justify-end px-2 tabular-nums text-muted-foreground">
          {row.availableHours}
        </div>
      ),
    }

    return [nameCol, ...projectCols, totalCol, availableCol]
  }, [visibleProjects, canEdit, commentsByCell])

  const projectIdAtColumnOffset = (anchorColumnKey: string, offset: number): string | null => {
    const idx = visibleProjects.findIndex((p) => p.id === anchorColumnKey)
    if (idx === -1) return null
    return visibleProjects[idx + offset]?.id ?? null
  }

  const handleRowsChange = (
    changedRows: GridRow[],
    { indexes, column }: { indexes: number[]; column: { key: string } }
  ) => {
    if (!activeMonthId) return
    for (const idx of indexes) {
      const row = changedRows[idx]
      const hours = row.hours[column.key] ?? 0
      upsertAllocation.mutate({ personId: row.personId, projectId: column.key, hours })
    }
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (!canEdit || !activeMonthId) return
    const anchor = activePosition.current
    if (!anchor) return
    const text = event.clipboardData.getData("text/plain")
    if (!text) return
    const isProjectColumn = visibleProjects.some((p) => p.id === anchor.columnKey)
    if (!isProjectColumn) return

    event.preventDefault()
    const lines = text.replace(/\r/g, "").split("\n")
    while (lines.length > 1 && lines[lines.length - 1] === "") lines.pop()

    lines.forEach((line, rowOffset) => {
      const targetRow = rows[anchor.rowIdx + rowOffset]
      if (!targetRow) return
      line.split("\t").forEach((rawValue, colOffset) => {
        const projectId =
          colOffset === 0 ? anchor.columnKey : projectIdAtColumnOffset(anchor.columnKey, colOffset)
        if (!projectId) return
        const parsed = Number(rawValue.replace(",", ".").trim())
        if (!Number.isFinite(parsed) || parsed < 0) return
        upsertAllocation.mutate({ personId: targetRow.personId, projectId, hours: parsed })
      })
    })
  }

  const handleActivePositionChange = (args: PositionChangeArgs<GridRow>) => {
    activePosition.current = args.column ? { rowIdx: args.rowIdx, columnKey: args.column.key } : null
  }

  const isLoading = loadingPeople || loadingProjects || loadingAllocations

  if (!activeMonthId) return <NoActiveMonth />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Distribución de trabajo</h1>
          <p className="text-sm text-muted-foreground">
            {canEdit
              ? "Edita horas directamente en la grilla. Se guardan automáticamente."
              : "Modo de solo lectura — tu rol puede consultar y comentar, no editar horas."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-transparent bg-success-muted text-success">Verde: exacto</Badge>
          <Badge className="border-transparent bg-warning-muted text-warning">
            Amarillo: faltan horas
          </Badge>
          <Badge className="border-transparent bg-danger-muted text-danger">Rojo: de más</Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar persona…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Ordenar por nombre</SelectItem>
            <SelectItem value="total">Ordenar por total</SelectItem>
            <SelectItem value="availableHours">Ordenar por disponible</SelectItem>
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
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : visibleProjects.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Crea al menos un proyecto activo en este mes para poder distribuir horas.
        </p>
      ) : (
        <div onPaste={handlePaste} className="overflow-hidden rounded-md border border-border">
          <DataGrid
            className="sabana-grid"
            columns={columns}
            rows={rows}
            rowKeyGetter={(row) => row.personId}
            onRowsChange={handleRowsChange}
            onFill={({ columnKey, sourceRow, targetRow }) => ({
              ...targetRow,
              hours: { ...targetRow.hours, [columnKey]: sourceRow.hours[columnKey] ?? 0 },
            })}
            onActivePositionChange={handleActivePositionChange}
            rowHeight={44}
            headerRowHeight={40}
            style={{ blockSize: "min(70svh, 640px)" }}
          />
        </div>
      )}

      {commentCell &&
        activeMonthId &&
        (() => {
          const person = allRows.find((r) => r.personId === commentCell.personId)
          const project = visibleProjects.find((p) => p.id === commentCell.projectId)
          if (!person || !project) return null
          return (
            <CellCommentsDialog
              open
              onOpenChange={(open) => !open && setCommentCell(null)}
              monthId={activeMonthId}
              personId={commentCell.personId}
              projectId={commentCell.projectId}
              personName={person.name}
              projectName={project.name}
              comments={commentsByCell.get(`${commentCell.personId}:${commentCell.projectId}`) ?? []}
            />
          )
        })()}
    </div>
  )
}
