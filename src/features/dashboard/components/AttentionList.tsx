import { Link } from "react-router"
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PersonMonthTotal } from "@/features/dashboard/api/dashboardApi"
import { cn } from "@/lib/utils"

interface AttentionListProps {
  people: PersonMonthTotal[]
}

// Lista accionable: solo las personas cuya asignación no cuadra, ordenadas
// por qué tan lejos están del objetivo. Si todas cuadran, se dice
// explícitamente en vez de mostrar una lista vacía.
export default function AttentionList({ people }: AttentionListProps) {
  const needsAttention = people
    .filter((p) => p.status_color !== "verde")
    .sort((a, b) => Math.abs(b.difference_hours) - Math.abs(a.difference_hours))
    .slice(0, 6)

  if (needsAttention.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <CheckCircle2 className="size-8 text-success" />
        <p className="text-sm font-medium">Todo el equipo está en balance</p>
        <p className="text-xs text-muted-foreground">
          Las horas asignadas coinciden con las disponibles en todas las personas.
        </p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {needsAttention.map((person, i) => {
        const over = person.status_color === "rojo"
        const utilization =
          person.available_hours > 0
            ? Math.round((person.allocated_hours / person.available_hours) * 100)
            : 0
        return (
          <li
            key={person.person_id}
            className="stagger-item flex items-center gap-3 rounded-lg border border-border p-2.5"
            style={{ "--i": i } as React.CSSProperties}
          >
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                over ? "bg-danger-muted text-danger" : "bg-warning-muted text-warning"
              )}
            >
              {over ? <AlertTriangle className="size-4" /> : <Clock className="size-4" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">{person.name}</span>
                <span
                  className={cn(
                    "shrink-0 text-xs font-semibold tabular-nums",
                    over ? "text-danger" : "text-warning"
                  )}
                >
                  {over ? "+" : ""}
                  {-person.difference_hours} h
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("animate-bar h-full rounded-full", over ? "bg-danger" : "bg-warning")}
                  style={{ width: `${Math.min(utilization, 100)}%` }}
                />
              </div>
            </div>
          </li>
        )
      })}
      <li>
        <Button variant="ghost" size="sm" asChild className="mt-1 w-full">
          <Link to="/distribucion">Ajustar en la distribución</Link>
        </Button>
      </li>
    </ul>
  )
}
