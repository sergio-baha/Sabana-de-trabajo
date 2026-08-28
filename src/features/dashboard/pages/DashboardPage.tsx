import { useMemo } from "react"
import { Link } from "react-router"
import {
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  Clock,
  FolderKanban,
  Gauge,
  History,
  ListChecks,
  TrendingUp,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import KpiCard from "@/components/shared/KpiCard"
import UtilizationGauge from "@/features/dashboard/components/UtilizationGauge"
import AttentionList from "@/features/dashboard/components/AttentionList"
import TopProjectsList from "@/features/dashboard/components/TopProjectsList"
import RecentChangesList from "@/features/dashboard/components/RecentChangesList"
import EjecucionPanel from "@/features/dashboard/components/EjecucionPanel"
import {
  usePersonTotals,
  useProjectTotals,
  useRecentChanges,
} from "@/features/dashboard/hooks/useDashboardQueries"
import { useMonths } from "@/features/months/hooks/useMonthsQueries"
import MonthStatusBadge from "@/features/months/components/MonthStatusBadge"
import NoActiveMonth from "@/components/shared/NoActiveMonth"
import { usePlanningExclusions } from "@/features/people/hooks/usePlanningExclusions"
import { useTaskAssignees, useTasks } from "@/features/tasks/hooks/useTasksQueries"
import { useProjects } from "@/features/projects/hooks/useProjectsQueries"
import { useActiveMonthStore } from "@/stores/activeMonthStore"
import { useSessionStore } from "@/stores/sessionStore"
import { isAdmin } from "@/lib/roles"
import { cn } from "@/lib/utils"

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

  // El Dashboard mide la planeación del equipo, y el Analista de Tecnología
  // queda fuera de ella. Dejar sus horas adentro inflaba la capacidad total
  // y lo hacía aparecer en "Requiere atención" por un desajuste que nadie va
  // a resolver desde la grilla.
  const excludedPersonIds = usePlanningExclusions(activeMonthId)

  // El panel de ejecución se arma en el cliente con las tarjetas del mes: el
  // dato ya existe en `tasks` (estimated_hours / completed_hours) y las
  // consultas son las mismas que usan Tareas y Cronograma, así que react-query
  // las sirve de caché. Si algún mes llega a tener miles de tarjetas, esto es
  // lo primero que habría que mover a una vista de la base.
  const { data: monthTasks } = useTasks(activeMonthId)
  const { data: monthAssignees } = useTaskAssignees(activeMonthId)
  const { data: allProjects } = useProjects()

  const visiblePersonTotals = useMemo(
    () => (personTotals ?? []).filter((row) => !excludedPersonIds.has(row.person_id)),
    [personTotals, excludedPersonIds]
  )

  const metrics = useMemo(() => {
    const people = visiblePersonTotals
    const projects = (projectTotals ?? []).filter((p) => p.status !== "archivado")
    const allocated = people.reduce((sum, p) => sum + p.allocated_hours, 0)
    const available = people.reduce((sum, p) => sum + p.available_hours, 0)
    return {
      totalPeople: people.length,
      totalProjects: projects.filter((p) => p.category !== "institucional").length,
      institutionalProjects: projects.filter((p) => p.category === "institucional").length,
      allocatedHours: allocated,
      availableHours: available,
      freeHours: Math.max(available - allocated, 0),
      utilization: available > 0 ? Math.round((allocated / available) * 100) : 0,
      balanced: people.filter((p) => p.status_color === "verde").length,
      overallocated: people.filter((p) => p.status_color === "rojo").length,
      underallocated: people.filter((p) => p.status_color === "amarillo").length,
    }
  }, [visiblePersonTotals, projectTotals])

  const isLoading = loadingPeople || loadingProjects

  if (!activeMonthId) return <NoActiveMonth />

  const balanceSegments = [
    { label: "En balance", count: metrics.balanced, className: "bg-success", text: "text-success" },
    {
      label: "Con horas libres",
      count: metrics.underallocated,
      className: "bg-warning",
      text: "text-warning",
    },
    {
      label: "Sobreasignadas",
      count: metrics.overallocated,
      className: "bg-danger",
      text: "text-danger",
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* Encabezado del mes activo — superficie clara con el filete de marca */}
      <div className="page-hero animate-fade-in">
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="text-eyebrow flex items-center gap-2 text-muted-foreground">
              <CalendarRange className="size-3.5" />
              Mes activo
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-display text-3xl font-black">
                {activeMonth?.name ?? "Sin mes"}
              </h1>
              {activeMonth && <MonthStatusBadge status={activeMonth.status} />}
            </div>
            <p className="max-w-xl text-sm text-muted-foreground">
              {isLoading
                ? "Cargando el resumen del mes…"
                : `${metrics.totalPeople} personas · ${metrics.allocatedHours} de ${metrics.availableHours} horas distribuidas` +
                  (metrics.overallocated > 0
                    ? ` · ${metrics.overallocated} con sobreasignación`
                    : " · sin sobreasignaciones")}
            </p>
          </div>
          <Button asChild className="btn-press">
            <Link to="/distribucion">
              Ir a la distribución <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="shimmer h-[86px] w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            index={0}
            label="Personas"
            value={metrics.totalPeople}
            icon={<Users className="size-5" />}
            tone="brand"
          />
          <KpiCard
            index={1}
            label="Proyectos"
            value={metrics.totalProjects}
            icon={<FolderKanban className="size-5" />}
            hint={
              metrics.institutionalProjects > 0
                ? `+${metrics.institutionalProjects} institucionales`
                : undefined
            }
          />
          <KpiCard
            index={2}
            label="Horas asignadas"
            value={metrics.allocatedHours}
            icon={<Clock className="size-5" />}
            suffix=" h"
            hint={`de ${metrics.availableHours} h`}
          />
          <KpiCard
            index={3}
            label="Horas libres"
            value={metrics.freeHours}
            icon={<TrendingUp className="size-5" />}
            suffix=" h"
          />
          <KpiCard
            index={4}
            label="Sobreasignadas"
            value={metrics.overallocated}
            icon={<AlertTriangle className="size-5" />}
            tone={metrics.overallocated > 0 ? "danger" : "default"}
          />
          <KpiCard
            index={5}
            label="Con horas libres"
            value={metrics.underallocated}
            icon={<Clock className="size-5" />}
            tone={metrics.underallocated > 0 ? "warning" : "default"}
          />
        </div>
      )}

      {/* Planeado contra ejecutado. Va arriba de la utilización a propósito:
          una vez el mes arranca, "¿cómo vamos contra lo estimado?" pesa más
          que "¿cuánto repartimos?", que ya es una decisión tomada. */}
      <EjecucionPanel
        tasks={monthTasks ?? []}
        assignees={monthAssignees ?? []}
        projects={allProjects ?? []}
        personTotals={visiblePersonTotals}
        projectTotals={projectTotals ?? []}
      />

      {/* Utilización + atención */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="card-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="size-4" /> Utilización del equipo
            </CardTitle>
            <CardDescription>Horas asignadas sobre la capacidad total del mes.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {isLoading ? (
              <Skeleton className="shimmer size-[168px] rounded-full" />
            ) : (
              <>
                <UtilizationGauge percent={metrics.utilization} />
                <div className="flex w-full flex-col gap-2">
                  {balanceSegments.map((segment) => (
                    <div key={segment.label} className="flex items-center gap-2 text-sm">
                      <span className={cn("size-2.5 rounded-full", segment.className)} />
                      <span className="flex-1 text-muted-foreground">{segment.label}</span>
                      <span className={cn("font-semibold tabular-nums", segment.text)}>
                        {segment.count}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="card-lift lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="size-4" /> Requiere atención
            </CardTitle>
            <CardDescription>
              Personas cuya asignación no cuadra con sus horas disponibles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="shimmer h-12 w-full" />
                ))}
              </div>
            ) : (
              <AttentionList people={visiblePersonTotals} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top proyectos + actividad reciente */}
      <div className={cn("grid gap-4", isAdmin(profile?.role) && "lg:grid-cols-2")}>
        <Card className="card-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderKanban className="size-4" /> Proyectos con más horas
            </CardTitle>
            <CardDescription>Dónde se está concentrando el esfuerzo del mes.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="shimmer h-9 w-full" />
                ))}
              </div>
            ) : (
              <TopProjectsList projects={projectTotals ?? []} />
            )}
          </CardContent>
        </Card>

        {isAdmin(profile?.role) && (
          <Card className="card-lift">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-4" /> Últimos cambios
              </CardTitle>
              <CardDescription>Actividad reciente registrada en este mes.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingChanges ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="shimmer h-6 w-full" />
                  ))}
                </div>
              ) : (
                <RecentChangesList changes={recentChanges ?? []} />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
