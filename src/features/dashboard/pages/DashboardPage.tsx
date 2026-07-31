import { useMemo } from "react"
import {
  AlertTriangle,
  CalendarRange,
  Clock,
  FolderKanban,
  History,
  TrendingUp,
  Users,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import KpiCard from "@/features/dashboard/components/KpiCard"
import RecentChangesList from "@/features/dashboard/components/RecentChangesList"
import { usePersonTotals, useProjectTotals, useRecentChanges } from "@/features/dashboard/hooks/useDashboardQueries"
import { useMonths } from "@/features/months/hooks/useMonthsQueries"
import MonthStatusBadge from "@/features/months/components/MonthStatusBadge"
import NoActiveMonth from "@/components/shared/NoActiveMonth"
import { useActiveMonthStore } from "@/stores/activeMonthStore"
import { useSessionStore } from "@/stores/sessionStore"
import { isAdmin } from "@/lib/roles"

export default function DashboardPage() {
  const { activeMonthId } = useActiveMonthStore()
  const profile = useSessionStore((s) => s.profile)
  const { data: months } = useMonths()
  const activeMonth = months?.find((m) => m.id === activeMonthId)

  const { data: personTotals, isLoading: loadingPeople } = usePersonTotals(activeMonthId)
  const { data: projectTotals, isLoading: loadingProjects } = useProjectTotals(activeMonthId)
  const { data: recentChanges, isLoading: loadingChanges } = useRecentChanges(
    activeMonthId,
    isAdmin(profile?.role)
  )

  const metrics = useMemo(() => {
    const people = personTotals ?? []
    const projects = (projectTotals ?? []).filter((p) => p.status !== "archivado")
    return {
      totalPeople: people.length,
      totalProjects: projects.length,
      allocatedHours: people.reduce((sum, p) => sum + p.allocated_hours, 0),
      availableHours: people.reduce((sum, p) => sum + p.available_hours, 0),
      overallocated: people.filter((p) => p.status_color === "rojo").length,
      underallocated: people.filter((p) => p.status_color === "amarillo").length,
    }
  }, [personTotals, projectTotals])

  const isLoading = loadingPeople || loadingProjects

  if (!activeMonthId) return <NoActiveMonth />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Resumen del mes activo.</p>
        </div>
        {activeMonth && (
          <div className="ml-auto flex items-center gap-2">
            <CalendarRange className="size-4 text-muted-foreground" />
            <span className="font-medium">{activeMonth.name}</span>
            <MonthStatusBadge status={activeMonth.status} />
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Personas" value={metrics.totalPeople} icon={<Users className="size-5" />} />
          <KpiCard
            label="Proyectos"
            value={metrics.totalProjects}
            icon={<FolderKanban className="size-5" />}
          />
          <KpiCard
            label="Horas asignadas"
            value={metrics.allocatedHours}
            icon={<Clock className="size-5" />}
          />
          <KpiCard
            label="Horas disponibles"
            value={metrics.availableHours}
            icon={<TrendingUp className="size-5" />}
          />
          <KpiCard
            label="Sobreasignadas"
            value={metrics.overallocated}
            icon={<AlertTriangle className="size-5" />}
            tone="danger"
          />
          <KpiCard
            label="Con horas libres"
            value={metrics.underallocated}
            icon={<Clock className="size-5" />}
            tone="warning"
          />
        </div>
      )}

      {isAdmin(profile?.role) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="size-4" /> Últimos cambios
            </CardTitle>
            <CardDescription>Actividad reciente registrada en este mes.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingChanges ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <RecentChangesList changes={recentChanges ?? []} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
