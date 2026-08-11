import { CalendarClock, GripVertical } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { PRIORITY_LABELS, WORK_ITEM_DOT, WORK_ITEM_LABELS } from "@/features/tasks/lib/taskLabels"
import type { Task } from "@/features/tasks/api/tasksApi"

interface TaskCardProps {
  task: Task
  projectName: string
  projectColor: string
  assigneeNames: string[]
  draggable: boolean
  isDragging: boolean
  onOpen: () => void
  onDragStart: (event: React.DragEvent) => void
  onDragEnd: () => void
  onDragOver: (event: React.DragEvent) => void
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase() || "?"
}

// Vence hoy o antes, y la tarjeta no está cerrada.
function isOverdue(task: Task) {
  if (!task.due_date || task.status === "completada") return false
  const today = new Date().toISOString().slice(0, 10)
  return task.due_date < today
}

export default function TaskCard({
  task,
  projectName,
  projectColor,
  assigneeNames,
  draggable,
  isDragging,
  onOpen,
  onDragStart,
  onDragEnd,
  onDragOver,
}: TaskCardProps) {
  const overdue = isOverdue(task)

  return (
    // La tarjeta entera es el handle de arrastre (como en Azure DevOps), y a
    // la vez un botón: Enter/Espacio abre el detalle, para que el tablero
    // siga siendo operable sin ratón aunque el arrastre no lo sea.
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        "group relative flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left shadow-xs transition",
        "hover:border-primary/40 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
        // Una tarjeta terminada se reconoce sin leerla: filo verde y fondo
        // teñido. Una bloqueada grita en rojo. El resto queda neutro para
        // que estos dos destaquen de verdad.
        task.status === "completada" &&
          "border-l-4 border-l-success bg-success-muted/25",
        task.status === "bloqueada" && "border-l-4 border-l-danger bg-danger-muted/25"
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn("mt-1.5 size-2 shrink-0 rounded-full", WORK_ITEM_DOT[task.work_item_type])}
          title={WORK_ITEM_LABELS[task.work_item_type]}
        />
        <p className="flex-1 text-sm leading-snug font-medium">{task.title}</p>
        {draggable && (
          <GripVertical className="size-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
        )}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: projectColor }} />
        <span className="truncate">{projectName}</span>
      </div>

      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-[11px] font-normal">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="px-1.5 py-0 text-[11px]">
            P{task.priority}
          </Badge>
          {task.estimated_hours !== null && (
            <span className="text-[11px] text-muted-foreground">{task.estimated_hours} h</span>
          )}
          {task.due_date && (
            <span
              className={cn(
                "flex items-center gap-1 text-[11px]",
                overdue ? "font-medium text-danger" : "text-muted-foreground"
              )}
              title={overdue ? "Vencida" : "Fecha límite"}
            >
              <CalendarClock className="size-3" />
              {task.due_date.slice(5)}
            </span>
          )}
        </div>
        {assigneeNames.length > 0 && (
          <div className="flex items-center -space-x-1.5">
            {assigneeNames.slice(0, 3).map((name, i) => (
              <Avatar
                key={i}
                className="size-6 ring-2 ring-card"
                title={`${name} · ${PRIORITY_LABELS[task.priority]}`}
              >
                <AvatarFallback className="bg-muted text-[10px]">{initialsFor(name)}</AvatarFallback>
              </Avatar>
            ))}
            {assigneeNames.length > 3 && (
              <Avatar className="size-6 ring-2 ring-card" title={assigneeNames.slice(3).join(", ")}>
                <AvatarFallback className="bg-muted text-[10px]">
                  +{assigneeNames.length - 3}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
