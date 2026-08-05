import { useMemo, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { buildRange } from "@/features/schedule/lib/scheduleRange"
import DayLogDialog from "@/features/schedule/components/DayLogDialog"
import type { ActivityWithCell } from "@/features/activities/api/activitiesApi"
import type { Project } from "@/features/projects/api/projectsApi"

interface TimeCalendarProps {
  monthId: string
  personId: string
  activities: ActivityWithCell[]
  projects: Project[]
  canLog: boolean
}

interface OpenCell {
  projectId: string
  projectName: string
  iso: string
}

// Rejilla proyecto × día con las horas realmente registradas. Las filas son
// proyectos y no tareas porque el registro de tiempo del sistema son las
// `activities`, que cuelgan de una celda persona × proyecto (no de un work
// item). El Gantt de al lado cubre la otra mitad: qué tarea ocupa qué días.
export default function TimeCalendar({
  monthId,
  personId,
  activities,
  projects,
  canLog,
}: TimeCalendarProps) {
  const [openCell, setOpenCell] = useState<OpenCell | null>(null)

  const days = useMemo(
    () => buildRange(activities.map((a) => a.activity_date)),
    [activities]
  )

  // Actividades indexadas por proyecto+día para no recorrer la lista una vez
  // por celda de la rejilla.
  const byCell = useMemo(() => {
    const map = new Map<string, ActivityWithCell[]>()
    for (const activity of activities) {
      if (!activity.activity_date) continue
      const key = `${activity.allocation.project_id}:${activity.activity_date}`
      const list = map.get(key) ?? []
      list.push(activity)
      map.set(key, list)
    }
    return map
  }, [activities])

  const visibleProjects = useMemo(
    () => projects.filter((p) => p.status !== "archivado"),
    [projects]
  )

  const dayTotals = useMemo(() => {
    const map = new Map<string, number>()
    for (const activity of activities) {
      if (!activity.activity_date) continue
      map.set(activity.activity_date, (map.get(activity.activity_date) ?? 0) + activity.hours)
    }
    return map
  }, [activities])

  const projectTotals = useMemo(() => {
    const map = new Map<string, number>()
    for (const activity of activities) {
      const id = activity.allocation.project_id
      map.set(id, (map.get(id) ?? 0) + activity.hours)
    }
    return map
  }, [activities])

  const grandTotal = activities.reduce((sum, a) => sum + a.hours, 0)

  if (visibleProjects.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        El mes activo no tiene proyectos donde registrar tiempo.
      </p>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-[720px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-background px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">
                Proyecto
              </th>
              {days.map((day) => (
                <th
                  key={day.iso}
                  className={cn(
                    "border-l border-border/50 px-0.5 py-1.5 text-center text-[10px] font-normal leading-tight",
                    day.isWeekend && "bg-muted/40",
                    day.isToday && "bg-primary/10 font-semibold text-primary"
                  )}
                  title={format(day.date, "PPP", { locale: es })}
                >
                  {format(day.date, "d")}
                </th>
              ))}
              <th className="border-l border-border px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleProjects.map((project) => (
              <tr key={project.id} className="border-t border-border/50">
                <td className="sticky left-0 z-10 max-w-48 bg-background px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="truncate text-xs">{project.name}</span>
                  </div>
                </td>
                {days.map((day) => {
                  const cellActivities = byCell.get(`${project.id}:${day.iso}`) ?? []
                  const hours = cellActivities.reduce((sum, a) => sum + a.hours, 0)

                  return (
                    <td
                      key={day.iso}
                      className={cn(
                        "border-l border-border/50 p-0 text-center",
                        day.isWeekend && "bg-muted/40",
                        day.isToday && "bg-primary/5"
                      )}
                    >
                      <button
                        type="button"
                        disabled={!canLog && hours === 0}
                        onClick={() =>
                          setOpenCell({
                            projectId: project.id,
                            projectName: project.name,
                            iso: day.iso,
                          })
                        }
                        className={cn(
                          "h-7 w-full min-w-8 text-[11px] tabular-nums transition",
                          hours > 0 ? "font-medium" : "text-muted-foreground/40",
                          (canLog || hours > 0) && "hover:bg-accent",
                          !canLog && hours === 0 && "cursor-default"
                        )}
                        title={
                          hours > 0
                            ? `${hours} h · ${cellActivities.length} actividad(es)`
                            : canLog
                              ? "Registrar tiempo"
                              : undefined
                        }
                      >
                        {hours > 0 ? hours : "·"}
                      </button>
                    </td>
                  )
                })}
                <td className="border-l border-border px-2 py-1.5 text-right text-xs tabular-nums">
                  {projectTotals.get(project.id) ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-medium">
              <td className="sticky left-0 z-10 bg-background px-2 py-1.5 text-xs">
                Total del día
              </td>
              {days.map((day) => (
                <td
                  key={day.iso}
                  className={cn(
                    "border-l border-border/50 px-0.5 py-1.5 text-center text-[11px] tabular-nums",
                    day.isWeekend && "bg-muted/40"
                  )}
                >
                  {dayTotals.get(day.iso) ?? ""}
                </td>
              ))}
              <td className="border-l border-border px-2 py-1.5 text-right text-xs tabular-nums">
                {grandTotal}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {openCell && (
        <DayLogDialog
          open
          onOpenChange={(open) => !open && setOpenCell(null)}
          monthId={monthId}
          personId={personId}
          projectId={openCell.projectId}
          projectName={openCell.projectName}
          dateIso={openCell.iso}
          activities={byCell.get(`${openCell.projectId}:${openCell.iso}`) ?? []}
          canLog={canLog}
        />
      )}
    </>
  )
}
