import { useMemo, useState } from "react"
import { KanbanSquare, Plus, Search, UserRoundX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import NoActiveMonth from "@/components/shared/NoActiveMonth"
import PageHeader from "@/components/shared/PageHeader"
import TaskBoard from "@/features/tasks/components/TaskBoard"
import TaskBacklogTable from "@/features/tasks/components/TaskBacklogTable"
import TaskFormDialog from "@/features/tasks/components/TaskFormDialog"
import { useTaskReviewFlow } from "@/features/tasks/hooks/useTaskReviewFlow"
import { useDeleteTask, useTaskAssignees, useTasks } from "@/features/tasks/hooks/useTasksQueries"
import { useRealtimeTasks } from "@/features/tasks/hooks/useRealtimeTasks"
import { STATUS_LABELS, WORK_ITEM_OPTIONS } from "@/features/tasks/lib/taskLabels"
import { buildAssigneeIdsByTask, buildAssigneesByTask } from "@/features/tasks/lib/taskAssignees"
import type { Task } from "@/features/tasks/api/tasksApi"
import { useProjectManagers, useProjects } from "@/features/projects/hooks/useProjectsQueries"
import { usePeople } from "@/features/people/hooks/usePeopleQueries"
import { useMonths } from "@/features/months/hooks/useMonthsQueries"
import { useMyPerson } from "@/features/schedule/hooks/useMyPerson"
import { useActiveMonthStore } from "@/stores/activeMonthStore"
import { useSessionStore } from "@/stores/sessionStore"
import { canManageTasks, isAnalistaTecnologia, writesOwnWorkOnly } from "@/lib/roles"
import type { TaskStatus } from "@/types/database.types"

const ALL = "all"

// Alcance del tablero. Solo tiene sentido para quien ve trabajo ajeno (Gestor
// y Administrador): un Analista ya recibe únicamente lo suyo desde la base.
const MINE = "mine"
const EVERYTHING = "everything"

export default function TareasPage() {
  const { activeMonthId } = useActiveMonthStore()
  const profile = useSessionStore((s) => s.profile)
  // El gating por rol de acá es solo de UX; la barrera real es RLS.
  // A diferencia de la grilla de horas, las tareas NO dependen del estado
  // del mes: un mes cerrado congela la contabilidad, no el trabajo.
  //
  // En Tareas los dos roles de analista quedan equivalentes: ambos ven y
  // escriben solo sus propias tarjetas (tasks_select_scoped usa
  // is_analista_role, no is_analista_tecnologia). `restrictedToSelf` es
  // alias de `writesOwn` a propósito, para que el día que un rol nuevo
  // "escriba lo suyo" sin estar acotado en lectura, este archivo tenga que
  // decidirlo explícitamente en vez de heredarlo en silencio.
  const writesOwn = writesOwnWorkOnly(profile?.role)
  const restrictedToSelf = writesOwn
  const { myPerson } = useMyPerson(activeMonthId)

  // El Analista de Tecnología no organiza su trabajo por mes: ve todas sus
  // tareas de una vez, con el mes como etiqueta en cada tarjeta. RLS ya
  // acota el resultado a lo suyo, así que quitar el filtro no expone nada.
  const ignoresMonths = isAnalistaTecnologia(profile?.role)

  const { data: tasks, isLoading } = useTasks(activeMonthId, { allMonths: ignoresMonths })
  const { data: projects } = useProjects()
  const { data: people } = usePeople(activeMonthId)
  const { data: taskAssignees } = useTaskAssignees(activeMonthId, { allMonths: ignoresMonths })
  const { data: months } = useMonths()
  const { data: managers } = useProjectManagers()

  // El estado del mes NO limita las tareas: cerrar o archivar un mes congela
  // las horas, no el trabajo. Ver *_tasks_ignore_month_lock.sql.
  //
  // Sin vínculo cuenta ↔ roster, RLS rechazaría cualquier tarea que creara
  // (no podría asignársela a sí mismo), así que no se ofrece la acción.
  const canWrite = canManageTasks(profile?.role) && (!writesOwn || Boolean(myPerson))

  // Entregar y devolver no son movimientos comunes: cada uno abre su diálogo
  // (horas reales / motivo). El hook trae los handlers y los diálogos.
  const { handleRequestReview, handleRequestReturn, dialogs: reviewDialogs } = useTaskReviewFlow()

  // Solo se pasa en modo "todos los meses": es lo que le dice a las vistas
  // que pinten la etiqueta, y evita ruido cuando el mes ya es el del filtro.
  const monthNameById = useMemo(() => {
    if (!ignoresMonths) return undefined
    return new Map((months ?? []).map((m) => [m.id, m.name]))
  }, [ignoresMonths, months])
  const deleteTask = useDeleteTask()
  useRealtimeTasks(activeMonthId)

  const assigneesByTask = useMemo(
    () => buildAssigneesByTask(taskAssignees ?? [], people ?? []),
    [taskAssignees, people]
  )
  const assigneeIdsByTask = useMemo(
    () => buildAssigneeIdsByTask(taskAssignees ?? []),
    [taskAssignees]
  )

  const [search, setSearch] = useState("")
  // El gestor abre en "Mis tareas": lo suyo y lo que le entregaron para
  // revisar. Ver todo lo de sus proyectos es un clic, pero no el punto de
  // partida — el tablero es para trabajar, no para supervisar.
  const [scope, setScope] = useState(restrictedToSelf ? EVERYTHING : MINE)
  const [projectFilter, setProjectFilter] = useState(ALL)
  const [personFilter, setPersonFilter] = useState(ALL)
  const [typeFilter, setTypeFilter] = useState(ALL)
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>("pendiente")
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)

  // Lo que ESTE usuario tiene que revisar: entregas de los proyectos que
  // gerencia. El tablero las pinta en su columna "Por hacer" — para quien
  // revisa, revisar es su pendiente; el que entregó las sigue viendo en
  // "En revisión", que es lo que le pasa a él: está esperando.
  //
  // Se excluye lo que uno mismo entregó: nadie se revisa a sí mismo (la base
  // aplica el mismo criterio en task_requires_review).
  const awaitingMyReview = useMemo(() => {
    const myPersonIds = new Set(
      (people ?? []).filter((p) => p.profile_id === profile?.id).map((p) => p.id)
    )
    const myProjectIds = new Set(
      (managers ?? []).filter((m) => myPersonIds.has(m.person_id)).map((m) => m.project_id)
    )
    if (myProjectIds.size === 0) return new Set<string>()
    return new Set(
      (tasks ?? [])
        .filter(
          (task) =>
            task.status === "en_revision" &&
            myProjectIds.has(task.project_id) &&
            task.submitted_by !== profile?.id
        )
        .map((task) => task.id)
    )
  }, [tasks, people, managers, profile?.id])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (tasks ?? []).filter((task) => {
      // "Mis tareas" para un gestor: lo que él creó, lo que le asignaron y lo
      // que le entregaron para revisar. RLS ya recortó el universo a sus
      // proyectos; esto es el corte de todos los días dentro de eso, para que
      // el tablero abra con su trabajo y no con el de todo el equipo.
      if (scope === MINE) {
        const mine =
          task.created_by === profile?.id ||
          awaitingMyReview.has(task.id) ||
          (myPerson ? (assigneeIdsByTask.get(task.id) ?? []).includes(myPerson.id) : false)
        if (!mine) return false
      }
      if (projectFilter !== ALL && task.project_id !== projectFilter) return false
      if (personFilter !== ALL && !(assigneeIdsByTask.get(task.id) ?? []).includes(personFilter))
        return false
      if (typeFilter !== ALL && task.work_item_type !== typeFilter) return false
      if (!q) return true
      return (
        task.title.toLowerCase().includes(q) ||
        (task.description ?? "").toLowerCase().includes(q) ||
        task.tags.some((tag) => tag.toLowerCase().includes(q))
      )
    })
  }, [
    tasks,
    search,
    scope,
    projectFilter,
    personFilter,
    typeFilter,
    assigneeIdsByTask,
    awaitingMyReview,
    myPerson,
    profile?.id,
  ])


  const counters = useMemo(() => {
    const total = filtered.length
    const done = filtered.filter((t) => t.status === "completada").length
    const blocked = filtered.filter((t) => t.status === "bloqueada").length
    const inProgress = filtered.filter(
      (t) => t.status === "en_progreso" || t.status === "en_revision"
    ).length
    return { total, done, blocked, inProgress }
  }, [filtered])

  const openNewTask = (status: TaskStatus) => {
    setEditingTask(null)
    setNewTaskStatus(status)
    setFormOpen(true)
  }

  const openTask = (task: Task) => {
    setEditingTask(task)
    setFormOpen(true)
  }

  if (!activeMonthId) return <NoActiveMonth />

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={KanbanSquare}
        eyebrow="Mi trabajo"
        title="Tareas"
        description={
          ignoresMonths
            ? "Todas tus tareas, de todos los meses."
            : "Tablero y backlog de work items del mes activo."
        }
        stats={[
          { label: "En total", value: counters.total },
          { label: "En curso", value: counters.inProgress },
          { label: "Bloqueadas", value: counters.blocked },
          { label: "Completadas", value: counters.done },
        ]}
        actions={
          canWrite && (
            <Button className="btn-press" onClick={() => openNewTask("pendiente")}>
              <Plus /> Nueva tarea
            </Button>
          )
        }
      />

      {writesOwn && !myPerson && (
        <div className="animate-fade-in flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-muted/40 p-3.5 text-sm">
          <UserRoundX className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            Tu cuenta todavía no está vinculada a una persona del mes activo, así que no puedes
            crear tareas
            {restrictedToSelf ? " y aquí no aparecerá ninguna" : ""}. Pide a un administrador o
            gestor que la vincule desde Personas → editar → Cuenta vinculada.
          </span>
        </div>
      )}

      <div className="filter-bar">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar título, descripción o etiqueta…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {/* Un analista no lo necesita: la base ya solo le manda lo suyo. */}
        {!restrictedToSelf && (
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MINE}>Mis tareas</SelectItem>
              <SelectItem value={EVERYTHING}>Todo lo de mis proyectos</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Proyecto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los proyectos</SelectItem>
            {(projects ?? []).map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Un Analista de Tecnología solo recibe sus propias tareas desde
            la base: filtrar por persona no tendría nada que filtrar. */}
        {!restrictedToSelf && (
          <Select value={personFilter} onValueChange={setPersonFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Persona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas las personas</SelectItem>
              {(people ?? []).map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  {person.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los tipos</SelectItem>
            {WORK_ITEM_OPTIONS.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-72" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="tablero">
          <TabsList>
            <TabsTrigger value="tablero">Tablero</TabsTrigger>
            <TabsTrigger value="backlog">Backlog</TabsTrigger>
          </TabsList>
          <TabsContent value="tablero" className="mt-4">
            <TaskBoard
              tasks={filtered}
              projects={projects ?? []}
              assigneesByTask={assigneesByTask}
              monthNameById={monthNameById}
              awaitingMyReview={awaitingMyReview}
              onRequestReview={handleRequestReview}
              onRequestReturn={handleRequestReturn}
              canWrite={canWrite}
              onOpenTask={openTask}
              onNewTask={openNewTask}
            />
          </TabsContent>
          <TabsContent value="backlog" className="mt-4">
            <Card>
              <CardContent>
                <TaskBacklogTable
                  tasks={filtered}
                  allTasks={tasks ?? []}
                  projects={projects ?? []}
                  assigneesByTask={assigneesByTask}
                  monthNameById={monthNameById}
                  onRequestReview={handleRequestReview}
                  onRequestReturn={handleRequestReturn}
                  canWrite={canWrite}
                  onOpenTask={openTask}
                  onDeleteTask={setTaskToDelete}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {reviewDialogs}
      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        monthId={activeMonthId}
        task={editingTask}
        defaultStatus={newTaskStatus}
        tasks={tasks ?? []}
        projects={projects ?? []}
        people={people ?? []}
        readOnly={!canWrite}
        defaultAssigneeIds={writesOwn && myPerson ? [myPerson.id] : []}
      />
      <ConfirmDialog
        open={Boolean(taskToDelete)}
        onOpenChange={(open) => !open && setTaskToDelete(null)}
        title={`Eliminar "${taskToDelete?.title}"`}
        description={`La tarea se elimina del tablero (estado actual: ${
          taskToDelete ? STATUS_LABELS[taskToDelete.status] : ""
        }). Sus work items hijos no se borran: quedan sin padre en el backlog.`}
        onConfirm={async () => {
          if (taskToDelete) await deleteTask.mutateAsync(taskToDelete.id)
        }}
      />
    </div>
  )
}
