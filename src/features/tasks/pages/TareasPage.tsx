import { useMemo, useState } from "react"
import { Plus, Search } from "lucide-react"
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
import TaskBoard from "@/features/tasks/components/TaskBoard"
import TaskBacklogTable from "@/features/tasks/components/TaskBacklogTable"
import TaskFormDialog from "@/features/tasks/components/TaskFormDialog"
import { useDeleteTask, useTasks } from "@/features/tasks/hooks/useTasksQueries"
import { useRealtimeTasks } from "@/features/tasks/hooks/useRealtimeTasks"
import { STATUS_LABELS, WORK_ITEM_OPTIONS } from "@/features/tasks/lib/taskLabels"
import type { Task } from "@/features/tasks/api/tasksApi"
import { useProjects } from "@/features/projects/hooks/useProjectsQueries"
import { usePeople } from "@/features/people/hooks/usePeopleQueries"
import { useActiveMonthStore } from "@/stores/activeMonthStore"
import { useSessionStore } from "@/stores/sessionStore"
import { isGestorOrAdmin } from "@/lib/roles"
import type { TaskStatus } from "@/types/database.types"

const ALL = "all"

export default function TareasPage() {
  const { activeMonthId } = useActiveMonthStore()
  const profile = useSessionStore((s) => s.profile)
  // Igual que la grilla: el gating por rol es solo de UX, y RLS
  // (can_write_month) es lo que además bloquea escribir en un mes cerrado.
  const canWrite = isGestorOrAdmin(profile?.role)

  const { data: tasks, isLoading } = useTasks(activeMonthId)
  const { data: projects } = useProjects(activeMonthId)
  const { data: people } = usePeople(activeMonthId)
  const deleteTask = useDeleteTask(activeMonthId ?? "")
  useRealtimeTasks(activeMonthId)

  const [search, setSearch] = useState("")
  const [projectFilter, setProjectFilter] = useState(ALL)
  const [personFilter, setPersonFilter] = useState(ALL)
  const [typeFilter, setTypeFilter] = useState(ALL)
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>("pendiente")
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (tasks ?? []).filter((task) => {
      if (projectFilter !== ALL && task.project_id !== projectFilter) return false
      if (personFilter !== ALL && task.assigned_person_id !== personFilter) return false
      if (typeFilter !== ALL && task.work_item_type !== typeFilter) return false
      if (!q) return true
      return (
        task.title.toLowerCase().includes(q) ||
        (task.description ?? "").toLowerCase().includes(q) ||
        task.tags.some((tag) => tag.toLowerCase().includes(q))
      )
    })
  }, [tasks, search, projectFilter, personFilter, typeFilter])

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Tareas</h1>
          <p className="text-sm text-muted-foreground">
            Tablero y backlog de work items del mes activo: {counters.total} en total,{" "}
            {counters.inProgress} en curso, {counters.blocked} bloqueadas, {counters.done}{" "}
            completadas.
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => openNewTask("pendiente")}>
            <Plus /> Nueva tarea
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar título, descripción o etiqueta…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
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
              monthId={activeMonthId}
              tasks={filtered}
              projects={projects ?? []}
              people={people ?? []}
              canWrite={canWrite}
              onOpenTask={openTask}
              onNewTask={openNewTask}
            />
          </TabsContent>
          <TabsContent value="backlog" className="mt-4">
            <Card>
              <CardContent>
                <TaskBacklogTable
                  monthId={activeMonthId}
                  tasks={filtered}
                  allTasks={tasks ?? []}
                  projects={projects ?? []}
                  people={people ?? []}
                  canWrite={canWrite}
                  onOpenTask={openTask}
                  onDeleteTask={setTaskToDelete}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

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
