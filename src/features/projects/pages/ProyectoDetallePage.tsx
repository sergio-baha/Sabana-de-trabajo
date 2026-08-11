import { useMemo, useState } from "react"
import { Link, useParams } from "react-router"
import { ArrowLeft, Pencil, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import TaskBoard from "@/features/tasks/components/TaskBoard"
import TaskBacklogTable from "@/features/tasks/components/TaskBacklogTable"
import TaskFormDialog from "@/features/tasks/components/TaskFormDialog"
import ProjectFormDialog from "@/features/projects/components/ProjectFormDialog"
import { useDeleteTask, useTasks } from "@/features/tasks/hooks/useTasksQueries"
import { useRealtimeTasks } from "@/features/tasks/hooks/useRealtimeTasks"
import { STATUS_LABELS } from "@/features/tasks/lib/taskLabels"
import type { Task } from "@/features/tasks/api/tasksApi"
import {
  useProjectManagers,
  useProjectMembers,
  useProjects,
} from "@/features/projects/hooks/useProjectsQueries"
import { usePeople } from "@/features/people/hooks/usePeopleQueries"
import { useMyPerson } from "@/features/schedule/hooks/useMyPerson"
import { useActiveMonthStore } from "@/stores/activeMonthStore"
import { useSessionStore } from "@/stores/sessionStore"
import { canManageTasks, isGestorOrAdmin, writesOwnWorkOnly } from "@/lib/roles"
import type { TaskStatus } from "@/types/database.types"

const STATUS_LABEL: Record<string, string> = {
  activo: "Activo",
  pausado: "Pausado",
  finalizado: "Finalizado",
  archivado: "Archivado",
}

// Página "gestionar este proyecto": entra desde /proyectos al hacer clic en
// una fila. Reutiliza el mismo tablero/backlog de Tareas, pero acotado a las
// tarjetas de este proyecto — así el journey es "entro al proyecto → veo y
// gestiono su trabajo", en vez de filtrar a mano el tablero global.
export default function ProyectoDetallePage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { activeMonthId } = useActiveMonthStore()
  const profile = useSessionStore((s) => s.profile)
  const canWrite = isGestorOrAdmin(profile?.role)
  const writesOwn = writesOwnWorkOnly(profile?.role)
  const { myPerson } = useMyPerson(activeMonthId)
  const canWriteTasks = canManageTasks(profile?.role) && (!writesOwn || Boolean(myPerson))

  const { data: projects, isLoading: projectsLoading } = useProjects(activeMonthId)
  const { data: people } = usePeople(activeMonthId)
  const { data: managers } = useProjectManagers(activeMonthId)
  const { data: members } = useProjectMembers(activeMonthId)
  const { data: tasks, isLoading: tasksLoading } = useTasks(activeMonthId)
  const deleteTask = useDeleteTask(activeMonthId ?? "")
  useRealtimeTasks(activeMonthId)

  const project = projects?.find((p) => p.id === projectId)
  const projectTasks = useMemo(
    () => (tasks ?? []).filter((t) => t.project_id === projectId),
    [tasks, projectId]
  )
  const teamPeople = useMemo(() => {
    const memberIds = new Set(
      (members ?? []).filter((m) => m.project_id === projectId).map((m) => m.person_id)
    )
    return (people ?? []).filter((p) => memberIds.has(p.id))
  }, [members, people, projectId])
  const managerName = people?.find(
    (p) => p.id === managers?.find((m) => m.project_id === projectId)?.person_id
  )?.name

  const [formOpen, setFormOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>("pendiente")
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)

  const openNewTask = (status: TaskStatus) => {
    setEditingTask(null)
    setNewTaskStatus(status)
    setFormOpen(true)
  }

  const openTask = (task: Task) => {
    setEditingTask(task)
    setFormOpen(true)
  }

  if (projectsLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!activeMonthId || !project) {
    return (
      <div className="flex flex-col items-start gap-3 py-12">
        <p className="text-sm text-muted-foreground">Este proyecto ya no existe en el mes activo.</p>
        <Button variant="outline" asChild>
          <Link to="/proyectos">
            <ArrowLeft /> Volver a proyectos
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Button variant="ghost" size="sm" asChild className="self-start">
        <Link to="/proyectos">
          <ArrowLeft /> Proyectos del mes
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <h1 className="text-xl font-semibold">{project.name}</h1>
            <Badge variant="outline">{STATUS_LABEL[project.status]}</Badge>
          </div>
          {project.description && (
            <p className="max-w-xl text-sm text-muted-foreground">{project.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {managerName && <span>Gerente: {managerName}</span>}
            {teamPeople.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                {managerName && <span>·</span>}
                {teamPeople.map((person) => (
                  <Badge key={person.id} variant="secondary">
                    {person.name}
                  </Badge>
                ))}
              </div>
            )}
            {!managerName && teamPeople.length === 0 && <span>Sin equipo asignado todavía.</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canWrite && (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil /> Editar proyecto
            </Button>
          )}
          {canWriteTasks && (
            <Button onClick={() => openNewTask("pendiente")}>
              <Plus /> Nueva tarea
            </Button>
          )}
        </div>
      </div>

      {tasksLoading ? (
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
              tasks={projectTasks}
              projects={projects ?? []}
              people={people ?? []}
              canWrite={canWriteTasks}
              onOpenTask={openTask}
              onNewTask={openNewTask}
            />
          </TabsContent>
          <TabsContent value="backlog" className="mt-4">
            <Card>
              <CardContent>
                <TaskBacklogTable
                  monthId={activeMonthId}
                  tasks={projectTasks}
                  allTasks={tasks ?? []}
                  projects={projects ?? []}
                  people={people ?? []}
                  canWrite={canWriteTasks}
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
        readOnly={!canWriteTasks}
        lockedPersonId={writesOwn ? myPerson?.id : null}
        lockedProjectId={project.id}
      />
      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        monthId={activeMonthId}
        project={project}
        people={people ?? []}
        currentManager={managers?.find((m) => m.project_id === project.id)}
        currentMemberIds={teamPeople.map((p) => p.id)}
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
