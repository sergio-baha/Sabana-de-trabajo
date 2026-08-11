import { useMemo, useState, type CSSProperties } from "react"
import { Link } from "react-router"
import { ArrowRight, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import ProjectFormDialog from "@/features/projects/components/ProjectFormDialog"
import BudgetBar from "@/features/portfolio/components/BudgetBar"
import {
  usePortfolioCosts,
  usePortfolioTotals,
} from "@/features/portfolio/hooks/usePortfolioQueries"
import { formatHours, formatMoney } from "@/features/portfolio/lib/portfolioLabels"
import { usePeople } from "@/features/people/hooks/usePeopleQueries"
import { useActiveMonthStore } from "@/stores/activeMonthStore"
import { useSessionStore } from "@/stores/sessionStore"
import { canCreateProjects, isGestorOrAdmin } from "@/lib/roles"
import type { ProjectStatus } from "@/types/database.types"

const STATUS_LABEL: Record<ProjectStatus, string> = {
  activo: "Activo",
  pausado: "Pausado",
  finalizado: "Finalizado",
  archivado: "Archivado",
}

// Lista de TODOS los proyectos del portafolio, sin importar el mes: un
// proyecto vive en varios meses y antes había que ir mes a mes para
// encontrarlo. La gestión real (fases, tareas, presupuesto, equipo) pasa a
// vivir dentro de cada proyecto — esta página es solo el punto de entrada.
export default function ProyectosPage() {
  const { activeMonthId } = useActiveMonthStore()
  const profile = useSessionStore((s) => s.profile)
  const canCreate = canCreateProjects(profile?.role) && Boolean(activeMonthId)
  const canSeeCost = isGestorOrAdmin(profile?.role)

  const { data: totals, isLoading } = usePortfolioTotals()
  const { data: costs } = usePortfolioCosts()
  const { data: people } = usePeople(activeMonthId)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "todos">("activo")
  const [formOpen, setFormOpen] = useState(false)

  const costByProject = useMemo(() => {
    const map = new Map<string, { labor: number; unrated: number }>()
    for (const c of costs ?? []) {
      map.set(c.portfolio_project_id, { labor: c.labor_cost, unrated: c.unrated_hours })
    }
    return map
  }, [costs])

  const filtered = useMemo(() => {
    const rows = totals ?? []
    const q = search.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (statusFilter === "todos" || r.status === statusFilter) &&
        (q === "" || r.name.toLowerCase().includes(q))
    )
  }, [totals, search, statusFilter])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Proyectos</h1>
          <p className="text-sm text-muted-foreground">
            Todos los proyectos del portafolio, en cualquier mes. Haz clic en uno para gestionar
            sus fases, tareas y presupuesto.
          </p>
        </div>
        {canCreate ? (
          <Button onClick={() => setFormOpen(true)}>
            <Plus /> Nuevo proyecto
          </Button>
        ) : (
          !activeMonthId && (
            <p className="text-xs text-muted-foreground">
              Activa un mes para poder crear proyectos.
            </p>
          )
        )}
      </div>

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
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No hay proyectos que coincidan con el filtro.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filtered.map((row, index) => {
                const cost = costByProject.get(row.portfolio_project_id)
                const spent = (cost?.labor ?? 0) + row.expense_total

                return (
                  <Link
                    key={row.portfolio_project_id}
                    to={`/proyectos/${row.portfolio_project_id}`}
                    className="stagger-item card-lift group flex flex-col gap-4 rounded-2xl border border-border bg-card p-4"
                    style={{ "--i": index } as CSSProperties}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          aria-hidden
                          className="size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: row.color }}
                        />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{row.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {row.months_count} {row.months_count === 1 ? "mes" : "meses"} ·{" "}
                            {row.people_count} {row.people_count === 1 ? "persona" : "personas"}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="outline">{STATUS_LABEL[row.status]}</Badge>
                        <ArrowRight className="size-4 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5" />
                      </div>
                    </div>

                    <BudgetBar
                      label="Horas"
                      spent={row.allocated_hours}
                      budget={row.budget_hours}
                      format={formatHours}
                    />

                    {canSeeCost ? (
                      <BudgetBar
                        label="Presupuesto"
                        spent={spent}
                        budget={row.budget_amount}
                        format={(v) => formatMoney(v, row.currency)}
                      />
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        El costo solo lo ve Gestor o Administrador.
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {activeMonthId && (
        <ProjectFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          monthId={activeMonthId}
          people={people ?? []}
        />
      )}
    </div>
  )
}
