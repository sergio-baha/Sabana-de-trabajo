import { Badge } from "@/components/ui/badge"
import type { ProjectMonthTotal } from "@/features/dashboard/api/dashboardApi"

interface TopProjectsListProps {
  projects: ProjectMonthTotal[]
  limit?: number
}

// Barras proporcionales al proyecto más grande, cada una con el color real
// del proyecto (la misma identidad que pinta su columna en la grilla), no
// una paleta categórica genérica que rotaría al cambiar el orden.
export default function TopProjectsList({ projects, limit = 6 }: TopProjectsListProps) {
  const ranked = [...projects]
    .filter((p) => p.allocated_hours > 0)
    .sort((a, b) => b.allocated_hours - a.allocated_hours)
    .slice(0, limit)

  if (ranked.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">Todavía no hay horas asignadas.</p>
  }

  const max = ranked[0].allocated_hours

  return (
    <ul className="flex flex-col gap-3">
      {ranked.map((project, i) => (
        <li
          key={project.project_id}
          className="stagger-item flex flex-col gap-1.5"
          style={{ "--i": i } as React.CSSProperties}
        >
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: project.color }}
              />
              <span className="truncate text-sm">{project.name}</span>
              {project.category === "institucional" && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  Institucional
                </Badge>
              )}
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {project.allocated_hours} h
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="animate-bar h-full rounded-full"
              style={{
                width: `${(project.allocated_hours / max) * 100}%`,
                backgroundColor: project.color,
                animationDelay: `${i * 60}ms`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
