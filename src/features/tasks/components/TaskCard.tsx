import { CalendarClock, GripVertical, MoreHorizontal, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { PRIORITY_LABELS, WORK_ITEM_DOT, WORK_ITEM_LABELS } from "@/features/tasks/lib/taskLabels"
import type { Task } from "@/features/tasks/api/tasksApi"

interface TaskCardProps {
  task: Task
  projectName: string
  projectColor: string
  assigneeNames: string[]
  /** Nombre del mes, solo en la vista que mezcla varios. */
  monthLabel?: string | null
  /** La entregaron y me toca revisarla: se pinta en mi columna "Por hacer". */
  awaitingMyReview?: boolean
  /** Solo se ofrece a quien de verdad puede borrarla (ver canDeleteTask). */
  onDelete?: () => void
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
  monthLabel,
  awaitingMyReview = false,
  onDelete,
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
        task.status === "bloqueada" && "border-l-4 border-l-danger bg-danger-muted/25",
        // Entregada y esperando MI revisión: filo naranja, para que no se
        // confunda con una tarea propia dentro de la misma columna.
        awaitingMyReview && "border-l-4 border-l-primary bg-accent/40"
      )}
    >
      {awaitingMyReview && (
        <Badge className="w-fit border-transparent bg-primary text-primary-foreground">
          Por revisar
        </Badge>
      )}
      <div className="flex items-start gap-2">
        <span
          className={cn("mt-1.5 size-2 shrink-0 rounded-full", WORK_ITEM_DOT[task.work_item_type])}
          title={WORK_ITEM_LABELS[task.work_item_type]}
        />
        <p className="flex-1 text-sm leading-snug font-medium">{task.title}</p>
        {/* Acciones de la tarjeta. Aparecen al pasar el mouse (o al enfocarlas
            con el teclado) para no meter un ícono fijo en cada tarjeta, y
            paran la propagación: un clic aquí no debe abrir el detalle ni
            arrancar el arrastre. */}
        {onDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Acciones de ${task.title}`}
                draggable={false}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
              <DropdownMenuItem
                variant="destructive"
                onClick={(event) => {
                  event.stopPropagation()
                  onDelete()
                }}
              >
                <Trash2 /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {draggable && (
          <GripVertical className="size-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
        )}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: projectColor }} />
        <span className="truncate">{projectName}</span>
        {/* Solo aparece en la vista sin filtro de mes (Analista de
            Tecnología): ahí conviven tarjetas de varios meses y el título
            por sí solo no las distingue. */}
        {monthLabel && (
          <Badge variant="outline" className="ml-auto shrink-0 px-1.5 py-0 text-[10px] font-normal">
            {monthLabel}
          </Badge>
        )}
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
          {/* Planeadas vs reales: en cuanto hay reporte, la comparación se
              lee en la tarjeta, que es donde se mira el trabajo. */}
          {task.estimated_hours !== null && (
            <span className="text-[11px] text-muted-foreground">
              {task.estimated_hours} h
              {(task.completed_hours ?? 0) > 0 && (
                <span
                  className={cn(
                    "font-medium",
                    (task.completed_hours ?? 0) > task.estimated_hours
                      ? "text-danger"
                      : "text-success"
                  )}
                  title="Horas reales reportadas"
                >
                  {" "}
                  · {task.completed_hours} reales
                </span>
              )}
            </span>
          )}
          {task.estimated_hours === null && (task.completed_hours ?? 0) > 0 && (
            <span className="text-[11px] text-muted-foreground" title="Horas reales reportadas">
              {task.completed_hours} h reales
            </span>
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
