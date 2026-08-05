import { useMemo } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { barGeometry, buildRange } from "@/features/schedule/lib/scheduleRange"
import { STATUS_LABELS, WORK_ITEM_DOT } from "@/features/tasks/lib/taskLabels"
import type { Task } from "@/features/tasks/api/tasksApi"
import type { Project } from "@/features/projects/api/projectsApi"

interface GanttChartProps {
  tasks: Task[]
  projects: Project[]
  onOpenTask: (task: Task) => void
}

export default function GanttChart({ tasks, projects, onOpenTask }: GanttChartProps) {
  const projectById = useMemo(() => {
    const map = new Map<string, Project>()
    for (const project of projects) map.set(project.id, project)
    return map
  }, [projects])

  // Una tarea sin ninguna fecha no puede dibujarse en un eje temporal. En
  // vez de esconderla (desaparecería sin explicación), se lista aparte para
  // que se vea que falta ponerle fechas.
  const { dated, undated } = useMemo(() => {
    const dated: Task[] = []
    const undated: Task[] = []
    for (const task of tasks) {
      if (task.start_date || task.due_date) dated.push(task)
      else undated.push(task)
    }
    dated.sort((a, b) => (a.start_date ?? a.due_date ?? "").localeCompare(b.start_date ?? b.due_date ?? ""))
    return { dated, undated }
  }, [tasks])

  const days = useMemo(
    () => buildRange(dated.flatMap((t) => [t.start_date, t.due_date])),
    [dated]
  )

  if (tasks.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No hay tareas para mostrar en el cronograma.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          {/* Cabecera de días */}
          <div className="flex border-b border-border">
            <div className="w-56 shrink-0 px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Work item
            </div>
            <div className="flex flex-1">
              {days.map((day) => (
                <div
                  key={day.iso}
                  className={cn(
                    "flex-1 border-l border-border/50 py-1.5 text-center text-[10px] leading-tight",
                    day.isWeekend && "bg-muted/40",
                    day.isToday && "bg-primary/10 font-semibold text-primary"
                  )}
                  title={format(day.date, "PPP", { locale: es })}
                >
                  {format(day.date, "d")}
                </div>
              ))}
            </div>
          </div>

          {dated.map((task) => {
            const geometry = barGeometry(days, task.start_date, task.due_date)
            const project = projectById.get(task.project_id)
            const isDone = task.status === "completada"

            return (
              <div key={task.id} className="flex items-center border-b border-border/50">
                <button
                  type="button"
                  onClick={() => onOpenTask(task)}
                  className="flex w-56 shrink-0 items-center gap-2 px-2 py-2 text-left text-xs hover:underline"
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      WORK_ITEM_DOT[task.work_item_type]
                    )}
                  />
                  <span className="truncate">{task.title}</span>
                </button>
                <div className="relative flex flex-1 self-stretch">
                  {days.map((day) => (
                    <div
                      key={day.iso}
                      className={cn(
                        "flex-1 border-l border-border/50",
                        day.isWeekend && "bg-muted/40",
                        day.isToday && "bg-primary/10"
                      )}
                    />
                  ))}
                  {geometry && (
                    <button
                      type="button"
                      onClick={() => onOpenTask(task)}
                      style={{
                        left: `${geometry.left}%`,
                        width: `${geometry.width}%`,
                        backgroundColor: project?.color ?? "var(--primary)",
                      }}
                      className={cn(
                        "absolute top-1/2 h-4 -translate-y-1/2 rounded-full transition hover:brightness-110",
                        isDone && "opacity-45"
                      )}
                      title={`${task.title} · ${STATUS_LABELS[task.status]}${
                        task.start_date ? ` · desde ${task.start_date}` : ""
                      }${task.due_date ? ` · hasta ${task.due_date}` : ""}`}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {undated.length > 0 && (
        <div className="rounded-lg border border-dashed border-border p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Sin fechas ({undated.length}) — no aparecen en el eje temporal hasta que se les
            asigne fecha de inicio o límite.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {undated.map((task) => (
              <Badge
                key={task.id}
                variant="secondary"
                className="cursor-pointer font-normal"
                onClick={() => onOpenTask(task)}
              >
                {task.title}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
