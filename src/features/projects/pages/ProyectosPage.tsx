import { useMemo, useState, type CSSProperties } from "react"
import { Link } from "react-router"
import { FolderKanban, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import PageHeader from "@/components/shared/PageHeader"
import EmptyState from "@/components/shared/EmptyState"
import ProjectFormDialog from "@/features/projects/components/ProjectFormDialog"
import {
  useProjectCosts,
  useProjectTotals,
} from "@/features/projects/hooks/useProjectBudgetQueries"
import { formatHours, formatMoney } from "@/features/projects/lib/projectLabels"
import {
  useDeleteProject,
  useProjectManagers,
  useProjectMembers,
  useProjects,
} from "@/features/projects/hooks/useProjectsQueries"
import { usePeople } from "@/features/people/hooks/usePeopleQueries"
import { useMyPerson } from "@/features/schedule/hooks/useMyPerson"
import { useActiveMonthStore } from "@/stores/activeMonthStore"
import { useSessionStore } from "@/stores/sessionStore"
import { canCreateProjects, canSeeCosts, isGestorOrAdmin } from "@/lib/roles"
import type { ProjectTotals } from "@/features/projects/api/projectBudgetApi"
import type { ProjectStatus } from "@/types/database.types"

const STATUS_LABEL: Record<ProjectStatus, string> = {
  activo: "Activo",
  pausado: "Pausado",
  finalizado: "Finalizado",
  archivado: "Archivado",
}

// Lista de TODOS los proyectos, sin importar el mes: un proyecto dura lo que
// dure y antes había que ir mes a mes para encontrarlo. La gestión real
// (fases, tareas, presupuesto, equipo) vive dentro de cada proyecto — esta
// página es solo el punto de entrada, separada en lo que cada quien puede
// gestionar y lo que solo puede ver.
export default function ProyectosPage() {
  const { activeMonthId } = useActiveMonthStore()
  const profile = useSessionStore((s) => s.profile)
  const canCreate = canCreateProjects(profile?.role)
  const canSeeCost = canSeeCosts(profile?.role)
  // Borrar un proyecto es de Gestor y Administrador, sin importar quién lo
  // creó — mismo criterio que projects_delete_write en la base.
  const canDelete = isGestorOrAdmin(profile?.role)

  const { data: totals, isLoading } = useProjectTotals()
  const { data: projects } = useProjects()
  const { data: costs } = useProjectCosts()
  const deleteProject = useDeleteProject()
  // Las personas siguen siendo del mes activo: la nómina sí es mensual.
  const { data: people } = usePeople(activeMonthId)
  const { data: managers } = useProjectManagers()
  const { data: members } = useProjectMembers()
  const { myPerson } = useMyPerson(activeMonthId)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "todos">("activo")
  const [formOpen, setFormOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null)

  const costByProject = useMemo(() => {
    const map = new Map<string, { labor: number; unrated: number }>()
    for (const c of costs ?? []) {
      map.set(c.project_id, { labor: c.labor_cost, unrated: c.unrated_hours })
    }
    return map
  }, [costs])

  const createdByProject = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const p of projects ?? []) map.set(p.id, p.created_by)
    return map
  }, [projects])

  // Gestionable = gestor/admin, quien creó el proyecto, o quien figura en su
  // equipo. Mismo criterio que la RLS (can_manage_project) — esto solo decide
  // qué se ve primero, la barrera real vive en la base.
  const canManage = useMemo(() => {
    const managedIds = new Set<string>()
    if (myPerson) {
      for (const m of managers ?? []) if (m.person_id === myPerson.id) managedIds.add(m.project_id)
      for (const m of members ?? []) if (m.person_id === myPerson.id) managedIds.add(m.project_id)
    }
    return (projectId: string) => {
      if (isGestorOrAdmin(profile?.role)) return true
      if (createdByProject.get(projectId) === profile?.id) return true
      return managedIds.has(projectId)
    }
  }, [profile, createdByProject, managers, members, myPerson])

  const filtered = useMemo(() => {
    const rows = totals ?? []
    const q = search.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (statusFilter === "todos" || r.status === statusFilter) &&
        (q === "" || r.name.toLowerCase().includes(q))
    )
  }, [totals, search, statusFilter])

  const mine = filtered.filter((r) => canManage(r.project_id))
  const others = filtered.filter((r) => !canManage(r.project_id))
  const totalHours = filtered.reduce((sum, r) => sum + r.allocated_hours, 0)

  const renderTable = (rows: ProjectTotals[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Proyecto</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Horas</TableHead>
          {canSeeCost && <TableHead>Presupuesto</TableHead>}
          <TableHead>Meses / Equipo</TableHead>
          {canDelete && <TableHead className="w-10" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const cost = costByProject.get(row.project_id)
          const spent = (cost?.labor ?? 0) + row.expense_total
          return (
            <TableRow
              key={row.project_id}
              className="row-enter"
              style={{ "--i": index } as CSSProperties}
            >
              <TableCell className="font-medium">
                <Link
                  to={`/proyectos/${row.project_id}`}
                  className="flex items-center gap-2 hover:underline"
                >
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                  {row.name}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{STATUS_LABEL[row.status]}</Badge>
              </TableCell>
              <TableCell className="text-sm tabular-nums">
                {formatHours(row.allocated_hours)}
                {row.budget_hours ? ` / ${formatHours(row.budget_hours)}` : ""}
              </TableCell>
              {canSeeCost && (
                <TableCell className="text-sm tabular-nums">
                  {formatMoney(spent, row.currency)}
                  {row.budget_amount ? ` / ${formatMoney(row.budget_amount, row.currency)}` : ""}
                </TableCell>
              )}
              <TableCell className="text-sm text-muted-foreground">
                {row.months_count} {row.months_count === 1 ? "mes" : "meses"} ·{" "}
                {row.people_count} {row.people_count === 1 ? "persona" : "personas"}
              </TableCell>
              {/* Borrar un proyecto es de Gestor y Administrador por igual
                  (projects_delete_write). Hasta ahora solo se podía desde la
                  grilla de Distribución, que es un lugar raro para buscarlo. */}
              {canDelete && (
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Acciones de ${row.name}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={`/proyectos/${row.project_id}`}>
                          <Pencil /> Abrir y gestionar
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setProjectToDelete({ id: row.project_id, name: row.name })}
                      >
                        <Trash2 /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={FolderKanban}
        eyebrow="Gestión"
        title="Proyectos"
        description="Todos los proyectos, en cualquier mes. Gestionas los que creaste o donde estás asignado; los demás quedan en modo consulta."
        stats={[
          { label: "Tuyos", value: mine.length },
          { label: "En consulta", value: others.length },
          { label: "Horas acumuladas", value: totalHours, suffix: " h" },
        ]}
        actions={
          canCreate && (
            <Button className="btn-press" onClick={() => setFormOpen(true)}>
              <Plus /> Nuevo proyecto
            </Button>
          )
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar proyecto…"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as ProjectStatus | "todos")}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="activo">Activos</SelectItem>
                <SelectItem value="pausado">Pausados</SelectItem>
                <SelectItem value="finalizado">Finalizados</SelectItem>
                <SelectItem value="archivado">Archivados</SelectItem>
              </SelectContent>
            </Select>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="No hay proyectos que coincidan"
              description="Prueba con otro estado o limpia la búsqueda para ver todos los proyectos."
            />
          ) : (
            <div className="flex flex-col gap-6">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Tus proyectos</h3>
                {mine.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No gestionas ningún proyecto todavía.
                  </p>
                ) : (
                  renderTable(mine)
                )}
              </div>
              {others.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                    Otros proyectos · solo consulta
                  </h3>
                  {renderTable(others)}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ProjectFormDialog open={formOpen} onOpenChange={setFormOpen} people={people ?? []} />

      <ConfirmDialog
        open={Boolean(projectToDelete)}
        onOpenChange={(open) => !open && setProjectToDelete(null)}
        title={`Eliminar "${projectToDelete?.name}"`}
        description="El proyecto es durable: se elimina de TODOS los meses, junto con sus horas repartidas, fases, tareas y comentarios. Si solo quieres sacarlo de la planeación en curso, márcalo como finalizado o archivado."
        onConfirm={async () => {
          if (projectToDelete) await deleteProject.mutateAsync(projectToDelete.id)
          setProjectToDelete(null)
        }}
      />
    </div>
  )
}
