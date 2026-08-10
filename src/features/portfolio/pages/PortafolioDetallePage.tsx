import { useMemo, useState, type CSSProperties } from "react"
import { Link, useParams } from "react-router"
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Info,
  Pencil,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import BudgetBar from "@/features/portfolio/components/BudgetBar"
import PhaseFormDialog from "@/features/portfolio/components/PhaseFormDialog"
import ExpenseFormDialog from "@/features/portfolio/components/ExpenseFormDialog"
import PortfolioFormDialog from "@/features/portfolio/components/PortfolioFormDialog"
import {
  useDeleteExpense,
  useDeletePhase,
  useExpenses,
  usePhaseCosts,
  usePhaseTotals,
  usePhases,
  usePortfolioCosts,
  usePortfolioProject,
  usePortfolioTotals,
  useReorderPhases,
} from "@/features/portfolio/hooks/usePortfolioQueries"
import {
  formatHours,
  formatMoney,
  PHASE_STATUS_DOT,
  PHASE_STATUS_LABEL,
} from "@/features/portfolio/lib/portfolioLabels"
import { useSessionStore } from "@/stores/sessionStore"
import { isGestorOrAdmin } from "@/lib/roles"
import type { ProjectExpense, ProjectPhase } from "@/features/portfolio/api/portfolioApi"

export default function PortafolioDetallePage() {
  const { projectId } = useParams<{ projectId: string }>()
  const profile = useSessionStore((s) => s.profile)
  const canWrite = isGestorOrAdmin(profile?.role)

  const { data: project, isLoading } = usePortfolioProject(projectId ?? null)
  const { data: totals } = usePortfolioTotals()
  const { data: costs } = usePortfolioCosts()
  const { data: phases } = usePhases(projectId ?? null)
  const { data: phaseTotals } = usePhaseTotals(projectId ?? null)
  const { data: phaseCosts } = usePhaseCosts()
  const { data: expenses } = useExpenses(projectId ?? null)

  const reorderPhases = useReorderPhases(projectId ?? "")
  const deletePhase = useDeletePhase(projectId ?? "")
  const deleteExpense = useDeleteExpense(projectId ?? "")

  const [editOpen, setEditOpen] = useState(false)
  const [phaseOpen, setPhaseOpen] = useState(false)
  const [editingPhase, setEditingPhase] = useState<ProjectPhase | null>(null)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [phaseToDelete, setPhaseToDelete] = useState<ProjectPhase | null>(null)
  const [expenseToDelete, setExpenseToDelete] = useState<ProjectExpense | null>(null)

  const totalsRow = totals?.find((t) => t.portfolio_project_id === projectId)
  const costRow = costs?.find((c) => c.portfolio_project_id === projectId)
  // Igual que en el listado: gating de UX. `costRow` puede venir vacío para
  // un Gestor simplemente porque el proyecto no tiene horas todavía, así que
  // no sirve para decidir si la cifra es visible.
  const canSeeCost = isGestorOrAdmin(profile?.role)

  const phaseCostById = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of phaseCosts ?? []) map.set(c.phase_id, c.labor_cost)
    return map
  }, [phaseCosts])

  // Horas del proyecto que no están clasificadas en ninguna fase. Salen de la
  // resta entre el total real (allocations) y lo desglosado en actividades:
  // mostrarlo evita que la suma de las fases parezca "el total" cuando en
  // realidad falta desglosar.
  const phasedHours = useMemo(
    () => (phaseTotals ?? []).reduce((sum, p) => sum + p.allocated_hours, 0),
    [phaseTotals]
  )
  const unphasedHours = Math.max((totalsRow?.allocated_hours ?? 0) - phasedHours, 0)

  const spent = (costRow?.labor_cost ?? 0) + (totalsRow?.expense_total ?? 0)

  const movePhase = (index: number, direction: -1 | 1) => {
    if (!phases) return
    const target = index + direction
    if (target < 0 || target >= phases.length) return
    const ordered = [...phases]
    const [moved] = ordered.splice(index, 1)
    ordered.splice(target, 0, moved)
    reorderPhases.mutate(ordered.map((p) => p.id))
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col items-start gap-3 py-12">
        <p className="text-sm text-muted-foreground">Este proyecto ya no existe en el portafolio.</p>
        <Button variant="outline" asChild>
          <Link to="/portafolio">
            <ArrowLeft /> Volver al portafolio
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Button variant="ghost" size="sm" asChild className="self-start">
        <Link to="/portafolio">
          <ArrowLeft /> Portafolio
        </Link>
      </Button>

      {/* Cabecera con el consumo global del proyecto */}
      <div className="surface-brand animate-fade-in relative overflow-hidden rounded-3xl p-6 shadow-brand-xl">
        <div
          aria-hidden
          className="aurora-blob pointer-events-none -top-20 -right-10 size-64 opacity-30"
          style={{ background: "var(--gradient-brand)" }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="text-eyebrow flex items-center gap-2 text-white/70">
              <span
                aria-hidden
                className="size-2.5 rounded-full ring-2 ring-white/40"
                style={{ backgroundColor: project.color }}
              />
              {project.category === "institucional" ? "Tiempo institucional" : "Proyecto"}
            </div>
            <h1 className="text-display text-3xl font-semibold text-white">{project.name}</h1>
            {project.description && (
              <p className="max-w-xl text-sm text-white/75">{project.description}</p>
            )}
            <p className="text-sm text-white/70">
              {totalsRow
                ? `${totalsRow.months_count} ${totalsRow.months_count === 1 ? "mes" : "meses"} · ${totalsRow.people_count} ${totalsRow.people_count === 1 ? "persona" : "personas"}`
                : "Sin horas registradas todavía"}
            </p>
          </div>
          {canWrite && (
            <Button className="btn-plain bg-white/15 text-white backdrop-blur-sm hover:bg-white/25" onClick={() => setEditOpen(true)}>
              <Pencil /> Editar
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="card-lift">
          <CardContent className="py-5">
            <BudgetBar
              label="Horas del proyecto"
              spent={totalsRow?.allocated_hours ?? 0}
              budget={project.budget_hours}
              format={formatHours}
            />
          </CardContent>
        </Card>
        <Card className="card-lift">
          <CardContent className="py-5">
            {canSeeCost ? (
              <>
                <BudgetBar
                  label="Presupuesto"
                  spent={spent}
                  budget={project.budget_amount}
                  format={(v) => formatMoney(v, project.currency)}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Nómina {formatMoney(costRow?.labor_cost ?? 0, project.currency)} · Gastos{" "}
                  {formatMoney(totalsRow?.expense_total ?? 0, project.currency)}
                </p>
                {(costRow?.unrated_hours ?? 0) > 0 && (
                  <p className="mt-1 flex items-start gap-1.5 text-xs text-warning">
                    <Info className="mt-0.5 size-3.5 shrink-0" />
                    {formatHours(costRow?.unrated_hours)} sin tarifa cargada: el costo de nómina
                    está subestimado.
                  </p>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                El presupuesto en dinero solo lo ve Gestor o Administrador.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Fases ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Fases</CardTitle>
            <CardDescription>
              Las horas por fase salen del desglose en actividades de cada celda, no de la celda
              completa — por eso pueden sumar menos que el total del proyecto.
            </CardDescription>
          </div>
          {canWrite && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingPhase(null)
                setPhaseOpen(true)
              }}
            >
              <Plus /> Fase
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(phaseTotals ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Este proyecto todavía no tiene fases.
            </p>
          ) : (
            (phaseTotals ?? []).map((phase, index) => {
              const phaseSpent = (phaseCostById.get(phase.phase_id) ?? 0) + phase.expense_total
              const source = phases?.find((p) => p.id === phase.phase_id)

              return (
                <div
                  key={phase.phase_id}
                  className="stagger-item card-lift flex flex-col gap-3 rounded-xl border border-border p-4"
                  style={{ "--i": index } as CSSProperties}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        aria-hidden
                        className={`size-2.5 rounded-full ${PHASE_STATUS_DOT[phase.status]}`}
                      />
                      <span className="font-medium">{phase.name}</span>
                      <Badge variant="outline">{PHASE_STATUS_LABEL[phase.status]}</Badge>
                      {(phase.start_date || phase.end_date) && (
                        <span className="text-xs text-muted-foreground">
                          {phase.start_date ?? "…"} → {phase.end_date ?? "…"}
                        </span>
                      )}
                    </div>
                    {canWrite && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Subir fase"
                          disabled={index === 0}
                          onClick={() => movePhase(index, -1)}
                        >
                          <ChevronUp />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Bajar fase"
                          disabled={index === (phaseTotals?.length ?? 0) - 1}
                          onClick={() => movePhase(index, 1)}
                        >
                          <ChevronDown />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Editar fase"
                          onClick={() => {
                            setEditingPhase(source ?? null)
                            setPhaseOpen(true)
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Eliminar fase"
                          onClick={() => source && setPhaseToDelete(source)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <BudgetBar
                      label="Horas"
                      spent={phase.allocated_hours}
                      budget={phase.budget_hours}
                      format={formatHours}
                    />
                    {canSeeCost && (
                      <BudgetBar
                        label="Presupuesto"
                        spent={phaseSpent}
                        budget={phase.budget_amount}
                        format={(v) => formatMoney(v, project.currency)}
                      />
                    )}
                  </div>
                </div>
              )
            })
          )}

          {unphasedHours > 0 && (
            <p className="flex items-start gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {formatHours(unphasedHours)} del proyecto todavía no están asignadas a una fase.
              Desglosa las celdas de la grilla en actividades para clasificarlas.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Gastos ─────────────────────────────────────────────────────── */}
      {canSeeCost && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="size-4" /> Gastos
              </CardTitle>
              <CardDescription>
                Gastos que no son nómina. El costo de las horas se calcula con las tarifas del
                equipo.
              </CardDescription>
            </div>
            {canWrite && (
              <Button variant="outline" size="sm" onClick={() => setExpenseOpen(true)}>
                <Plus /> Gasto
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {(expenses ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sin gastos registrados.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Fase</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    {canWrite && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(expenses ?? []).map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {expense.incurred_on}
                      </TableCell>
                      <TableCell>{expense.concept}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {phases?.find((p) => p.id === expense.phase_id)?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(expense.amount, project.currency)}
                      </TableCell>
                      {canWrite && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Eliminar gasto"
                            onClick={() => setExpenseToDelete(expense)}
                          >
                            <Trash2 />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <PortfolioFormDialog open={editOpen} onOpenChange={setEditOpen} project={project} />
      <PhaseFormDialog
        open={phaseOpen}
        onOpenChange={setPhaseOpen}
        portfolioProjectId={project.id}
        phase={editingPhase}
        nextPosition={phases?.length ?? 0}
      />
      <ExpenseFormDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        portfolioProjectId={project.id}
        phases={phases ?? []}
      />

      <ConfirmDialog
        open={Boolean(phaseToDelete)}
        onOpenChange={(open) => !open && setPhaseToDelete(null)}
        title="Eliminar fase"
        description={
          phaseToDelete
            ? `Se eliminará "${phaseToDelete.name}". Las actividades y tareas que estaban en esta fase no se borran: quedan sin fase asignada.`
            : ""
        }
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (phaseToDelete) deletePhase.mutate(phaseToDelete.id)
          setPhaseToDelete(null)
        }}
      />
      <ConfirmDialog
        open={Boolean(expenseToDelete)}
        onOpenChange={(open) => !open && setExpenseToDelete(null)}
        title="Eliminar gasto"
        description={
          expenseToDelete ? `Se eliminará "${expenseToDelete.concept}".` : ""
        }
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (expenseToDelete) deleteExpense.mutate(expenseToDelete.id)
          setExpenseToDelete(null)
        }}
      />
    </div>
  )
}
