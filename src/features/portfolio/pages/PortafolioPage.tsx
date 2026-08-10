import { useMemo, useState, type CSSProperties } from "react"
import { Link } from "react-router"
import { ArrowRight, Plus, Search, Wallet } from "lucide-react"
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
import BudgetBar from "@/features/portfolio/components/BudgetBar"
import PortfolioFormDialog from "@/features/portfolio/components/PortfolioFormDialog"
import {
  usePortfolioCosts,
  usePortfolioTotals,
} from "@/features/portfolio/hooks/usePortfolioQueries"
import {
  formatHours,
  formatMoney,
} from "@/features/portfolio/lib/portfolioLabels"
import { useSessionStore } from "@/stores/sessionStore"
import { isGestorOrAdmin } from "@/lib/roles"
import type { ProjectStatus } from "@/types/database.types"

const STATUS_LABEL: Record<ProjectStatus, string> = {
  activo: "Activo",
  pausado: "Pausado",
  finalizado: "Finalizado",
  archivado: "Archivado",
}

export default function PortafolioPage() {
  const profile = useSessionStore((s) => s.profile)
  const canWrite = isGestorOrAdmin(profile?.role)

  const { data: totals, isLoading } = usePortfolioTotals()
  const { data: costs } = usePortfolioCosts()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "todos">("activo")
  const [formOpen, setFormOpen] = useState(false)

  // El costo llega de una vista aparte (solo Gestor/Admin la ven). Un mapa
  // vacío significa "sin acceso al costo", no "todo cuesta cero".
  const costByProject = useMemo(() => {
    const map = new Map<string, { labor: number; unrated: number }>()
    for (const c of costs ?? []) {
      map.set(c.portfolio_project_id, { labor: c.labor_cost, unrated: c.unrated_hours })
    }
    return map
  }, [costs])

  // Gating de UX nada más: la barrera real es la vista v_portfolio_project_cost,
  // que filtra a Gestor/Administrador dentro del propio SQL. Sin esto, el
  // resto de roles vería una barra de presupuesto en cero — que se lee como
  // "no se ha gastado nada", no como "no tienes acceso a esta cifra".
  const canSeeCost = isGestorOrAdmin(profile?.role)

  const filtered = useMemo(() => {
    const rows = totals ?? []
    const q = search.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (statusFilter === "todos" || r.status === statusFilter) &&
        (q === "" || r.name.toLowerCase().includes(q))
    )
  }, [totals, search, statusFilter])

  // Resumen de cabecera: cuánto hay comprometido en el portafolio completo.
  const summary = useMemo(() => {
    let budget = 0
    let spent = 0
    let hours = 0
    let over = 0
    for (const row of filtered) {
      const cost = costByProject.get(row.portfolio_project_id)
      const rowSpent = (cost?.labor ?? 0) + row.expense_total
      budget += row.budget_amount ?? 0
      spent += rowSpent
      hours += row.allocated_hours
      if (row.budget_amount !== null && rowSpent > row.budget_amount) over += 1
    }
    return { budget, spent, hours, over }
  }, [filtered, costByProject])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-eyebrow flex items-center gap-2 text-muted-foreground">
            <Wallet className="size-3.5" />
            Portafolio
          </div>
          <h1 className="text-display mt-1 text-2xl font-semibold">Proyectos y presupuesto</h1>
          <p className="text-sm text-muted-foreground">
            Cada proyecto acumula las horas de todos los meses contra un mismo presupuesto.
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus /> Nuevo proyecto
          </Button>
        )}
      </div>

      {/* Resumen del portafolio filtrado */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Proyectos", value: filtered.length.toString() },
          { label: "Horas acumuladas", value: formatHours(summary.hours) },
          {
            label: "Presupuesto",
            value: summary.budget > 0 ? formatMoney(summary.budget) : "—",
          },
          {
            label: "En sobregiro",
            value: summary.over.toString(),
            tone: summary.over > 0 ? "text-danger" : undefined,
          },
        ].map((kpi, index) => (
          <Card
            key={kpi.label}
            className="stagger-item card-lift"
            style={{ "--i": index } as CSSProperties}
          >
            <CardContent className="flex flex-col gap-1 py-4">
              <span className="text-eyebrow text-muted-foreground">{kpi.label}</span>
              <span className={`text-2xl font-semibold tabular-nums ${kpi.tone ?? ""}`}>
                {kpi.value}
              </span>
            </CardContent>
          </Card>
        ))}
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
                    to={`/portafolio/${row.portfolio_project_id}`}
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

      <PortfolioFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  )
}
