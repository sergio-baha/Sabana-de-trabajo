import { useMemo, useState } from "react"
import { Clock, FileSpreadsheet, FileText, FolderKanban, TrendingUp, Users } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import NoActiveMonth from "@/components/shared/NoActiveMonth"
import KpiCard from "@/features/dashboard/components/KpiCard"
import { usePersonTotals, useProjectTotals } from "@/features/dashboard/hooks/useDashboardQueries"
import { useManagerTotals } from "@/features/reports/hooks/useReportsQueries"
import ProjectHoursChart from "@/features/reports/components/ProjectHoursChart"
import ManagerHoursChart from "@/features/reports/components/ManagerHoursChart"
import WorkloadRankingChart from "@/features/reports/components/WorkloadRankingChart"
import { exportReportToExcel } from "@/features/reports/lib/exportExcel"
import { useMonths } from "@/features/months/hooks/useMonthsQueries"
import { useSettings } from "@/features/settings/hooks/useSettingsQueries"
import { useActiveMonthStore } from "@/stores/activeMonthStore"

export default function ReportesPage() {
  const { activeMonthId } = useActiveMonthStore()
  const { data: months } = useMonths()
  const { data: settings } = useSettings()
  const activeMonth = months?.find((m) => m.id === activeMonthId)

  const { data: people, isLoading: loadingPeople } = usePersonTotals(activeMonthId)
  const { data: projects, isLoading: loadingProjects } = useProjectTotals(activeMonthId)
  const { data: managers, isLoading: loadingManagers } = useManagerTotals(activeMonthId)

  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null)

  const metrics = useMemo(() => {
    const p = people ?? []
    const pr = (projects ?? []).filter((x) => x.status !== "archivado")
    return {
      totalPeople: p.length,
      totalProjects: pr.length,
      allocatedHours: p.reduce((sum, x) => sum + x.allocated_hours, 0),
      availableHours: p.reduce((sum, x) => sum + x.available_hours, 0),
    }
  }, [people, projects])

  const isLoading = loadingPeople || loadingProjects || loadingManagers

  const handleExportExcel = async () => {
    if (!activeMonth || !people || !projects || !managers) return
    setExporting("excel")
    try {
      await exportReportToExcel({ monthName: activeMonth.name, people, projects, managers })
    } catch (error) {
      toast.error("No se pudo exportar a Excel", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setExporting(null)
    }
  }

  const handleExportPdf = async () => {
    if (!activeMonth || !people || !projects || !managers) return
    setExporting("pdf")
    try {
      // Carga diferida: @react-pdf/renderer trae su propio motor de layout
      // (yoga) y pesa varios MB — no tiene sentido que viaje en el bundle
      // principal para una acción que la mayoría de sesiones no dispara.
      const { exportReportToPdf } = await import("@/features/reports/lib/exportPdf")
      await exportReportToPdf({
        companyName: settings?.company_name ?? "Mi Empresa",
        monthName: activeMonth.name,
        people,
        projects,
        managers,
      })
    } catch (error) {
      toast.error("No se pudo exportar a PDF", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setExporting(null)
    }
  }

  if (!activeMonthId) return <NoActiveMonth />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Reportes</h1>
          <p className="text-sm text-muted-foreground">
            Resumen ejecutivo de {activeMonth?.name ?? "este mes"}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportExcel} disabled={isLoading || exporting !== null}>
            <FileSpreadsheet /> {exporting === "excel" ? "Exportando…" : "Exportar Excel"}
          </Button>
          <Button onClick={handleExportPdf} disabled={isLoading || exporting !== null}>
            <FileText /> {exporting === "pdf" ? "Exportando…" : "Exportar PDF"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Horas por proyecto</CardTitle>
            <CardDescription>Distribución de horas asignadas por proyecto activo.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading ? <Skeleton className="h-full w-full" /> : <ProjectHoursChart projects={projects ?? []} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Horas por gerente</CardTitle>
            <CardDescription>Carga total de proyectos bajo cada gerente responsable.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading ? <Skeleton className="h-full w-full" /> : <ManagerHoursChart managers={managers ?? []} />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ranking de carga laboral</CardTitle>
          <CardDescription>
            Horas asignadas y % de utilización por persona, de mayor a menor carga.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <WorkloadRankingChart people={people ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
