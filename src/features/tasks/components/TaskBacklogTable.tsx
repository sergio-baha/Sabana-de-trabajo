import { useMemo } from "react"
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  PRIORITY_LABELS,
  STATUS_BADGE,
  STATUS_LABELS,
  STATUS_OPTIONS,
  WORK_ITEM_DOT,
  WORK_ITEM_LABELS,
} from "@/features/tasks/lib/taskLabels"
import { nextBoardOrder, type Task } from "@/features/tasks/api/tasksApi"
import { useMoveTask } from "@/features/tasks/hooks/useTasksQueries"
import type { Project } from "@/features/projects/api/projectsApi"
import type { TaskStatus } from "@/types/database.types"

interface TaskBacklogTableProps {
  monthId: string
  tasks: Task[]
  allTasks: Task[]
  projects: Project[]
  // Nombres de los asignados de cada tarea, ya resueltos por el caller
  // (task_assignees + people) — una tarea puede tener varias personas.
  assigneesByTask: Map<string, string[]>
  canWrite: boolean
  onOpenTask: (task: Task) => void
  onDeleteTask: (task: Task) => void
}

// Vista de lista del backlog: las mismas tarjetas del tablero ordenadas por
// prioridad, para planificar sin arrastrar. El estado se cambia desde el
// select de cada fila (equivalente a mover la tarjeta de columna).
export default function TaskBacklogTable({
  monthId,
  tasks,
  allTasks,
  projects,
  assigneesByTask,
  canWrite,
  onOpenTask,
  onDeleteTask,
}: TaskBacklogTableProps) {
  const moveTask = useMoveTask(monthId)

  const projectById = useMemo(() => {
    const map = new Map<string, Project>()
    for (const project of projects) map.set(project.id, project)
    return map
  }, [projects])

  const sorted = useMemo(
    () =>
      [...tasks].sort(
        (a, b) => a.priority - b.priority || a.board_order - b.board_order
      ),
    [tasks]
  )

  const changeStatus = (task: Task, status: TaskStatus) => {
    if (status === task.status) return
    // Cambiar de estado desde la lista manda la tarjeta al final de su nueva
    // columna del tablero, que es donde el usuario esperaría encontrarla.
    moveTask.mutate({ id: task.id, status, boardOrder: nextBoardOrder(allTasks, status) })
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Work item</TableHead>
          <TableHead>Proyecto</TableHead>
          <TableHead>Asignada a</TableHead>
          <TableHead className="w-44">Estado</TableHead>
          <TableHead>Prioridad</TableHead>
          <TableHead className="text-right">Est. / Trab.</TableHead>
          <TableHead>Vence</TableHead>
          {canWrite && <TableHead className="w-10" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((task) => {
          const project = projectById.get(task.project_id)
          const assigneeNames = assigneesByTask.get(task.id) ?? []

          return (
            <TableRow key={task.id}>
              <TableCell>
                <button
                  type="button"
                  onClick={() => onOpenTask(task)}
                  className="flex items-start gap-2 text-left hover:underline"
                >
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      WORK_ITEM_DOT[task.work_item_type]
                    )}
                    title={WORK_ITEM_LABELS[task.work_item_type]}
                  />
                  <span className="font-medium">{task.title}</span>
                </button>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: project?.color ?? "transparent" }}
                  />
                  <span className="text-sm">{project?.name ?? "—"}</span>
                </div>
              </TableCell>
              <TableCell className="text-sm">
                {assigneeNames.length > 0 ? assigneeNames.join(", ") : "—"}
              </TableCell>
              <TableCell>
                {canWrite ? (
                  <Select
                    value={task.status}
                    onValueChange={(v) => changeStatus(task, v as TaskStatus)}
                  >
                    {/* El propio disparador lleva el color del estado: es la
                        forma de que la columna se lea de un vistazo sin
                        renunciar a poder cambiarlo desde la misma fila. */}
                    <SelectTrigger
                      className={cn(
                        "h-8 w-full font-medium",
                        STATUS_BADGE[task.status],
                        "[&_svg]:opacity-70"
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    {/* Sin punto de color en las opciones: SelectItem mete
                        todos sus hijos dentro de ItemText, que es lo que
                        Radix refleja en el disparador — el punto acabaría
                        sobre el fondo ya coloreado del estado, invisible y
                        dejando un hueco. */}
                    <SelectContent>
                      {STATUS_OPTIONS.map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={STATUS_BADGE[task.status]}>{STATUS_LABELS[task.status]}</Badge>
                )}
              </TableCell>
              <TableCell className="text-sm">{PRIORITY_LABELS[task.priority]}</TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {task.estimated_hours ?? "—"} / {task.completed_hours ?? "—"}
              </TableCell>
              <TableCell className="text-sm">{task.due_date ?? "—"}</TableCell>
              {canWrite && (
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onOpenTask(task)}>
                        <Pencil /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => onDeleteTask(task)}>
                        <Trash2 /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          )
        })}
        {sorted.length === 0 && (
          <TableRow>
            <TableCell colSpan={canWrite ? 8 : 7} className="text-center text-muted-foreground">
              Sin tareas que coincidan con el filtro.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
