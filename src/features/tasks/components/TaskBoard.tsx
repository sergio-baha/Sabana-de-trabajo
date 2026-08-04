import { useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import TaskCard from "@/features/tasks/components/TaskCard"
import { BOARD_COLUMNS, STATUS_ACCENT, STATUS_LABELS } from "@/features/tasks/lib/taskLabels"
import { orderForDrop, type Task } from "@/features/tasks/api/tasksApi"
import { useMoveTask } from "@/features/tasks/hooks/useTasksQueries"
import type { Project } from "@/features/projects/api/projectsApi"
import type { Person } from "@/features/people/api/peopleApi"
import type { TaskStatus } from "@/types/database.types"

interface TaskBoardProps {
  monthId: string
  tasks: Task[]
  projects: Project[]
  people: Person[]
  canWrite: boolean
  onOpenTask: (task: Task) => void
  onNewTask: (status: TaskStatus) => void
}

interface DropTarget {
  status: TaskStatus
  beforeId: string | null
}

// Arrastre con la API nativa de HTML5 (dragstart/dragover/drop) en vez de
// una librería de DnD: el tablero solo necesita mover tarjetas entre cinco
// columnas, y así el módulo no agrega dependencias al bundle. El indicador
// de inserción es una línea entre tarjetas, como en Azure DevOps Boards.
export default function TaskBoard({
  monthId,
  tasks,
  projects,
  people,
  canWrite,
  onOpenTask,
  onNewTask,
}: TaskBoardProps) {
  const moveTask = useMoveTask(monthId)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

  const projectById = useMemo(() => {
    const map = new Map<string, Project>()
    for (const project of projects) map.set(project.id, project)
    return map
  }, [projects])

  const personById = useMemo(() => {
    const map = new Map<string, Person>()
    for (const person of people) map.set(person.id, person)
    return map
  }, [people])

  const byColumn = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>()
    for (const status of BOARD_COLUMNS) map.set(status, [])
    for (const task of tasks) map.get(task.status)?.push(task)
    for (const list of map.values()) list.sort((a, b) => a.board_order - b.board_order)
    return map
  }, [tasks])

  const endDrag = () => {
    setDraggingId(null)
    setDropTarget(null)
  }

  const handleDrop = (status: TaskStatus) => {
    if (!draggingId) return
    const dragged = tasks.find((t) => t.id === draggingId)
    const beforeId = dropTarget?.status === status ? dropTarget.beforeId : null

    // Soltar la tarjeta exactamente donde ya estaba no genera un UPDATE.
    if (dragged && dragged.status === status && beforeId === dragged.id) {
      endDrag()
      return
    }

    const boardOrder = orderForDrop(tasks, status, draggingId, beforeId)
    moveTask.mutate({ id: draggingId, status, boardOrder })
    endDrag()
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {BOARD_COLUMNS.map((status) => {
        const columnTasks = byColumn.get(status) ?? []
        const isTargetColumn = dropTarget?.status === status

        return (
          <section
            key={status}
            onDragOver={(event) => {
              if (!draggingId) return
              event.preventDefault()
              // Sobre el espacio libre de la columna: insertar al final.
              setDropTarget({ status, beforeId: null })
            }}
            onDrop={(event) => {
              event.preventDefault()
              handleDrop(status)
            }}
            className={cn(
              "flex w-72 shrink-0 flex-col gap-2 rounded-xl border border-border bg-muted/30 p-2 transition",
              isTargetColumn && "border-primary/50 bg-primary/5"
            )}
          >
            <div className="flex items-center gap-2 px-1 pt-1">
              <span className={cn("size-2 rounded-full", STATUS_ACCENT[status])} />
              <h2 className="text-sm font-semibold">{STATUS_LABELS[status]}</h2>
              <span className="text-xs text-muted-foreground">{columnTasks.length}</span>
              {canWrite && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto size-6"
                  onClick={() => onNewTask(status)}
                  aria-label={`Nueva tarea en ${STATUS_LABELS[status]}`}
                >
                  <Plus className="size-4" />
                </Button>
              )}
            </div>

            <div className="flex min-h-24 flex-col gap-2">
              {columnTasks.map((task) => {
                const project = projectById.get(task.project_id)
                const assignee = task.assigned_person_id
                  ? personById.get(task.assigned_person_id)
                  : null

                return (
                  <div key={task.id} className="flex flex-col gap-2">
                    {isTargetColumn && dropTarget?.beforeId === task.id && (
                      <div className="h-0.5 rounded-full bg-primary" />
                    )}
                    <TaskCard
                      task={task}
                      projectName={project?.name ?? "—"}
                      projectColor={project?.color ?? "var(--muted-foreground)"}
                      assigneeName={assignee?.name ?? null}
                      draggable={canWrite}
                      isDragging={draggingId === task.id}
                      onOpen={() => onOpenTask(task)}
                      onDragStart={(event) => {
                        setDraggingId(task.id)
                        event.dataTransfer.effectAllowed = "move"
                        // Firefox no inicia el arrastre sin datos en el
                        // dataTransfer, aunque el id se lleve en el estado.
                        event.dataTransfer.setData("text/plain", task.id)
                      }}
                      onDragEnd={endDrag}
                      onDragOver={(event) => {
                        if (!draggingId) return
                        event.preventDefault()
                        // Evita que el handler de la columna sobrescriba la
                        // posición precisa con "al final".
                        event.stopPropagation()
                        const rect = event.currentTarget.getBoundingClientRect()
                        const inTopHalf = event.clientY < rect.top + rect.height / 2
                        const index = columnTasks.findIndex((t) => t.id === task.id)
                        const next = columnTasks[index + 1]
                        setDropTarget({
                          status,
                          beforeId: inTopHalf ? task.id : (next?.id ?? null),
                        })
                      }}
                    />
                  </div>
                )
              })}

              {isTargetColumn && dropTarget?.beforeId === null && (
                <div className="h-0.5 rounded-full bg-primary" />
              )}

              {columnTasks.length === 0 && !isTargetColumn && (
                <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                  Sin tarjetas.
                </p>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
