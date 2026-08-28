import { useMemo, useState, type CSSProperties } from "react"
import { Link, useNavigate, useParams } from "react-router"
import {
  ArrowLeft,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Info,
  MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Users,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import AnimatedNumber from "@/components/shared/AnimatedNumber"
import EmptyState from "@/components/shared/EmptyState"
import BudgetBar from "@/features/projects/components/BudgetBar"
import PhaseFormDialog from "@/features/projects/components/PhaseFormDialog"
import FasesTimeline from "@/features/projects/components/FasesTimeline"
import ExpenseFormDialog from "@/features/projects/components/ExpenseFormDialog"
import {
  useDeleteExpense,
  useDeletePhase,
  useExpenses,
  usePhaseCosts,
  usePhaseTotals,
  usePhases,
  useProjectCosts,
  useProjectTotals,
  useReorderPhases,
} from "@/features/projects/hooks/useProjectBudgetQueries"
import {
  CATEGORY_LABEL,
  formatHours,
  formatMoney,
  PHASE_STATUS_DOT,
  PHASE_STATUS_LABEL,
} from "@/features/projects/lib/projectLabels"
import TaskBacklogTable from "@/features/tasks/components/TaskBacklogTable"
import { useTaskReviewFlow } from "@/features/tasks/hooks/useTaskReviewFlow"
import TaskFormDialog from "@/features/tasks/components/TaskFormDialog"
import ImportTasksDialog from "@/features/tasks/components/ImportTasksDialog"
import ProjectFormDialog from "@/features/projects/components/ProjectFormDialog"
import { useDeleteTask, useTaskAssignees, useTasks } from "@/features/tasks/hooks/useTasksQueries"
import { useRealtimeTasks } from "@/features/tasks/hooks/useRealtimeTasks"
import { STATUS_LABELS } from "@/features/tasks/lib/taskLabels"
import { buildAssigneesByTask } from "@/features/tasks/lib/taskAssignees"
import type { Task } from "@/features/tasks/api/tasksApi"
import {
  useDeleteProject,
  useProject,
  useProjectManagers,
  useProjectMembers,
  useProjects,
} from "@/features/projects/hooks/useProjectsQueries"
import { usePeople } from "@/features/people/hooks/usePeopleQueries"
import { useMyPerson } from "@/features/schedule/hooks/useMyPerson"
import { useActiveMonthStore } from "@/stores/activeMonthStore"
import { useSessionStore } from "@/stores/sessionStore"
import { canManageTasks, canSeeCosts, isGestorOrAdmin, writesOwnWorkOnly } from "@/lib/roles"
import type { ProjectPhase, ProjectExpense } from "@/features/projects/api/projectBudgetApi"
import type { TaskStatus } from "@/types/database.types"

// "Gestionar el proyecto" vive aquí: identidad, presupuesto, equipo y sus
// tareas, organizadas por fase en vez de por estado — un proyecto se piensa
// en etapas (Descubrir → Definir → …), no en columnas de tablero. Todo eso
// es del proyecto completo; lo único mensual son las horas repartidas
// (allocations) y las tareas, que se filtran por el mes activo.
export default function ProyectoDetallePage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { activeMonthId } = useActiveMonthStore()
  const profile = useSessionStore((s) => s.profile)
  const canWrite = isGestorOrAdmin(profile?.role)
  const canSeeCost = canSeeCosts(profile?.role)
  const writesOwn = writesOwnWorkOnly(profile?.role)
  const { myPerson } = useMyPerson(activeMonthId)
  const canWriteTasks = canManageTasks(profile?.role) && (!writesOwn || Boolean(myPerson))

  const { data: project, isLoading } = useProject(projectId ?? null)
  const { data: totals } = useProjectTotals()
  const { data: costs } = useProjectCosts()
  const { data: phases } = usePhases(projectId ?? null)
  const { data: phaseTotals } = usePhaseTotals(projectId ?? null)
  const { data: phaseCosts } = usePhaseCosts()
  const { data: expenses } = useExpenses(projectId ?? null)

  const { data: projects } = useProjects()
  const deleteProject = useDeleteProject()

  const { data: tasks } = useTasks(activeMonthId)
  const projectTasks = useMemo(
    () => (tasks ?? []).filter((t) => t.project_id === projectId),
    [tasks, projectId]
  )
  const deleteTask = useDeleteTask()
  useRealtimeTasks(activeMonthId)

  const { data: people } = usePeople(activeMonthId)
  const { data: taskAssignees } = useTaskAssignees(activeMonthId)
  const assigneesByTask = useMemo(
    () => buildAssigneesByTask(taskAssignees ?? [], people ?? []),
    [taskAssignees, people]
  )
  const { data: managers } = useProjectManagers()
  const { data: members } = useProjectMembers()
  const projectManager = managers?.find((m) => m.project_id === projectId)
  const managerName = people?.find((p) => p.id === projectManager?.person_id)?.name
  const teamPeople = useMemo(() => {
    const ids = new Set(
      (members ?? []).filter((m) => m.project_id === projectId).map((m) => m.person_id)
    )
    return (people ?? []).filter((p) => ids.has(p.id))
  }, [members, people, projectId])

  // Mismo circuito que en Tareas: entregar pide horas reales y devolver pide
  // el motivo, se mueva la tarjeta desde donde se mueva.
  const { handleRequestReview, handleRequestReturn, dialogs: reviewDialogs } = useTaskReviewFlow()

  const reorderPhases = useReorderPhases(projectId ?? "")
  const deletePhase = useDeletePhase(projectId ?? "")
  const deleteExpense = useDeleteExpense(projectId ?? "")

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [teamOpen, setTeamOpen] = useState(false)
  const [phaseOpen, setPhaseOpen] = useState(false)
  const [editingPhase, setEditingPhase] = useState<ProjectPhase | null>(null)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [phaseToDelete, setPhaseToDelete] = useState<ProjectPhase | null>(null)
  const [expenseToDelete, setExpenseToDelete] = useState<ProjectExpense | null>(null)

  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [newTaskPhaseId, setNewTaskPhaseId] = useState<string | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const openNewTask = (phaseId: string | null) => {
    setEditingTask(null)
    setNewTaskPhaseId(phaseId)
    setTaskFormOpen(true)
  }
  const openTask = (task: Task) => {
    setEditingTask(task)
    setTaskFormOpen(true)
  }

  const totalsRow = totals?.find((t) => t.project_id === projectId)
  const costRow = costs?.find((c) => c.project_id === projectId)

  const phaseCostById = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of phaseCosts ?? []) map.set(c.phase_id, c.labor_cost)
    return map
  }, [phaseCosts])

  const phasedHours = useMemo(
    () => (phaseTotals ?? []).reduce((sum, p) => sum + p.allocated_hours, 0),
    [phaseTotals]
  )
  const unphasedHours = Math.max((totalsRow?.allocated_hours ?? 0) - phasedHours, 0)
  const spent = (costRow?.labor_cost ?? 0) + (totalsRow?.expense_total ?? 0)

  const unphasedTasks = useMemo(
    () => projectTasks.filter((t) => !t.phase_id),
    [projectTasks]
  )

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
        <p className="text-sm text-muted-foreground">Este proyecto ya no existe.</p>
        <Button variant="outline" asChild>
          <Link to="/proyectos">
            <ArrowLeft /> Volver a proyectos
          </Link>
        </Button>
      </div>
    )
  }

  // Gestionable = gestor/admin, quien creó el proyecto, o quien figura en su
  // equipo — mismo criterio que la RLS (can_manage_project). Sin esto,
  // cualquiera vería los botones de gestión aunque la base los rechazara.
  const canManageProject =
    canWrite ||
    project.created_by === profile?.id ||
    Boolean(
      myPerson &&
        ((managers ?? []).some(
          (m) => m.project_id === project.id && m.person_id === myPerson.id
        ) ||
          (members ?? []).some(
            (m) => m.project_id === project.id && m.person_id === myPerson.id
          ))
    )
  const canManageTeamAndTasks = canManageProject && canWriteTasks

  return (
    <div className="flex flex-col gap-5">
      <Button variant="ghost" size="sm" asChild className="self-start">
        <Link to="/proyectos">
          <ArrowLeft /> Proyectos
        </Link>
      </Button>

      {/* Cabecera con el consumo global del proyecto */}
      <div className="page-hero animate-fade-in">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div
              aria-hidden
              className="hidden size-12 shrink-0 place-content-center rounded-xl bg-muted sm:grid"
            >
              <span
                className="size-4 rounded-full ring-2 ring-border"
                style={{ backgroundColor: project.color }}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-eyebrow text-muted-foreground">
                {CATEGORY_LABEL[project.category]}
              </span>
              <h1 className="text-display text-xl font-extrabold sm:text-2xl">{project.name}</h1>
              {project.description && (
                <p className="max-w-2xl text-sm text-muted-foreground">{project.description}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canManageProject && (
              <Button className="btn-press" onClick={() => setEditOpen(true)}>
                <Pencil /> Editar
              </Button>
            )}
            {/* Eliminar el proyecto entero es de Gestor y Administrador por
                igual (projects_delete_write), no de quien lo creó. */}
            {canWrite && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Más acciones del proyecto">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 /> Eliminar proyecto
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-4">
          {[
            { label: totalsRow?.months_count === 1 ? "Mes" : "Meses", value: totalsRow?.months_count ?? 0 },
            { label: "Personas", value: totalsRow?.people_count ?? 0 },
            { label: "Horas", value: totalsRow?.allocated_hours ?? 0, suffix: " h" },
            { label: "Fases", value: (phaseTotals ?? []).length },
            { label: "Tareas del mes", value: projectTasks.length },
          ].map((stat, index) => (
            <div
              key={stat.label}
              className="reveal flex flex-col"
              style={{ "--i": index } as CSSProperties}
            >
              <span className="text-display text-2xl font-black tabular-nums">
                <AnimatedNumber value={stat.value} suffix={stat.suffix} />
              </span>
              <span className="text-eyebrow text-muted-foreground">{stat.label}</span>
            </div>
          ))}
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

      {/* ── Equipo del proyecto ────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" /> Equipo
            </CardTitle>
            <CardDescription>
              Quién puede recibir tareas de este proyecto. El equipo acompaña al proyecto mientras
              dure — no hay que rearmarlo cada mes.
            </CardDescription>
          </div>
          {canManageTeamAndTasks && (
            <Button variant="outline" size="sm" onClick={() => setTeamOpen(true)}>
              <Pencil /> Gestionar equipo
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            {managerName && <span className="text-muted-foreground">Gerente: {managerName}</span>}
            {teamPeople.length > 0 ? (
              teamPeople.map((person) => (
                <Badge key={person.id} variant="secondary">
                  {person.name}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">Sin equipo asignado todavía.</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Los momentos del proyecto en el tiempo ─────────────────────────
          La planeación del gestor, aparte de la sábana: las fases cruzan
          meses y sus fechas no dependen del mes activo. La columna de horas
          es la que conecta las dos cosas — son las horas que el equipo ya
          repartió contra cada fase desde la grilla. */}
      {(phaseTotals ?? []).length > 0 && (
        <Card className="card-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarRange className="size-4" /> Cronograma del proyecto
            </CardTitle>
            <CardDescription>
              Los momentos del proyecto en el tiempo. Las fechas son del proyecto, no del mes
              activo: una fase puede cruzar varios meses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FasesTimeline fases={phaseTotals ?? []} />
          </CardContent>
        </Card>
      )}

      {/* ── Fases y sus tareas ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Fases</CardTitle>
            <CardDescription>
              Las tareas del mes activo se agrupan por fase. Las horas por fase salen del
              desglose en actividades, no de la tarea completa.
            </CardDescription>
          </div>
          {canManageProject && (
            <div className="flex items-center gap-2">
              {canManageTeamAndTasks && (
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <FileSpreadsheet /> Importar Excel
                </Button>
              )}
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
            </div>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {(phaseTotals ?? []).length === 0 ? (
            <EmptyState
              icon={Plus}
              title="Este proyecto todavía no tiene fases"
              description="Las fases organizan las tareas en etapas (Descubrir, Definir, Entregar…). Agrega la primera para empezar."
              action={
                canManageProject && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingPhase(null)
                      setPhaseOpen(true)
                    }}
                  >
                    <Plus /> Agregar fase
                  </Button>
                )
              }
            />
          ) : (
            (phaseTotals ?? []).map((phase, index) => {
              const phaseSpent = (phaseCostById.get(phase.phase_id) ?? 0) + phase.expense_total
              const source = phases?.find((p) => p.id === phase.phase_id)
              const phaseTasks = projectTasks.filter((t) => t.phase_id === phase.phase_id)

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
                    <div className="flex items-center gap-1">
                      {canManageTeamAndTasks && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openNewTask(phase.phase_id)}
                        >
                          <Plus /> Tarea
                        </Button>
                      )}
                      {canManageProject && (
                        <>
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
                        </>
                      )}
                    </div>
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

                  {phaseTasks.length > 0 ? (
                    <div className="overflow-hidden rounded-lg border border-border">
                      <TaskBacklogTable
                        tasks={phaseTasks}
                        allTasks={tasks ?? []}
                        projects={projects ?? []}
                        assigneesByTask={assigneesByTask}
                        onRequestReview={handleRequestReview}
                        onRequestReturn={handleRequestReturn}
                        canWrite={canManageTeamAndTasks}
                        onOpenTask={openTask}
                        onDeleteTask={setTaskToDelete}
                      />
                    </div>
                  ) : (
                    <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                      Sin tareas en esta fase todavía.
                    </p>
                  )}
                </div>
              )
            })
          )}

          {unphasedHours > 0 && (
            <p className="flex items-start gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {formatHours(unphasedHours)} del proyecto todavía no están asignadas a una fase.
            </p>
          )}

          {/* ── Sin fase ──────────────────────────────────────────────── */}
          {(unphasedTasks.length > 0 || (phases ?? []).length > 0) && (
            <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-muted-foreground">Sin fase asignada</span>
                {canManageTeamAndTasks && (
                  <Button variant="ghost" size="sm" onClick={() => openNewTask(null)}>
                    <Plus /> Tarea
                  </Button>
                )}
              </div>
              {unphasedTasks.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-border">
                  <TaskBacklogTable
                    tasks={unphasedTasks}
                    allTasks={tasks ?? []}
                    projects={projects ?? []}
                    assigneesByTask={assigneesByTask}
                    onRequestReview={handleRequestReview}
                    onRequestReturn={handleRequestReturn}
                    canWrite={canManageTeamAndTasks}
                    onOpenTask={openTask}
                    onDeleteTask={setTaskToDelete}
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sin tareas sueltas.</p>
              )}
            </div>
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

      {/* "Editar" y "Gestionar equipo" son el mismo formulario: detrás hay una
          sola fila de `projects` que actualizar. */}
      <ProjectFormDialog
        open={editOpen || teamOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditOpen(false)
            setTeamOpen(false)
          }
        }}
        project={project}
        people={people ?? []}
        currentManager={projectManager}
        currentMemberIds={teamPeople.map((p) => p.id)}
      />
      <PhaseFormDialog
        open={phaseOpen}
        onOpenChange={setPhaseOpen}
        projectId={project.id}
        phase={editingPhase}
        nextPosition={phases?.length ?? 0}
      />
      <ExpenseFormDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        projectId={project.id}
        phases={phases ?? []}
      />
      {activeMonthId && (
        <>
          <TaskFormDialog
            open={taskFormOpen}
            onOpenChange={setTaskFormOpen}
            monthId={activeMonthId}
            task={editingTask}
            defaultStatus={"pendiente" as TaskStatus}
            defaultPhaseId={newTaskPhaseId}
            tasks={tasks ?? []}
            projects={projects ?? []}
            people={people ?? []}
            readOnly={!canManageTeamAndTasks}
            defaultAssigneeIds={writesOwn && myPerson ? [myPerson.id] : []}
            lockedProjectId={project.id}
          />
          <ImportTasksDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            monthId={activeMonthId}
            projectId={project.id}
            projectName={project.name}
            phases={phases ?? []}
            people={teamPeople}
            existingTasks={projectTasks}
          />
        </>
      )}

      {reviewDialogs}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Eliminar "${project.name}"`}
        description="El proyecto es durable: se elimina de TODOS los meses, junto con sus horas repartidas, fases, tareas y comentarios. Si solo quieres sacarlo de la planeación en curso, márcalo como finalizado o archivado."
        onConfirm={async () => {
          await deleteProject.mutateAsync(project.id)
          navigate("/proyectos")
        }}
      />

      <ConfirmDialog
        open={Boolean(phaseToDelete)}
        onOpenChange={(open) => !open && setPhaseToDelete(null)}
        title="Eliminar fase"
        description={
          phaseToDelete
            ? `Se eliminará "${phaseToDelete.name}". Las tareas y actividades que estaban en esta fase no se borran: quedan sin fase asignada.`
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
        description={expenseToDelete ? `Se eliminará "${expenseToDelete.concept}".` : ""}
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (expenseToDelete) deleteExpense.mutate(expenseToDelete.id)
          setExpenseToDelete(null)
        }}
      />
      <ConfirmDialog
        open={Boolean(taskToDelete)}
        onOpenChange={(open) => !open && setTaskToDelete(null)}
        title={`Eliminar "${taskToDelete?.title}"`}
        description={`La tarea se elimina del proyecto (estado actual: ${
          taskToDelete ? STATUS_LABELS[taskToDelete.status] : ""
        }). Sus work items hijos no se borran: quedan sin padre en el backlog.`}
        onConfirm={async () => {
          if (taskToDelete) await deleteTask.mutateAsync(taskToDelete.id)
        }}
      />
    </div>
  )
}
