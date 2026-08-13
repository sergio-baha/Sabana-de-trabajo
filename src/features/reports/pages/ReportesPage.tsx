import { useMemo, useState } from "react"
import {
  BarChart3,
  Clock,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  TrendingUp,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import NoActiveMonth from "@/components/shared/NoActiveMonth"
import PageHeader from "@/components/shared/PageHeader"
import KpiCard from "@/components/shared/KpiCard"
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
  // Solo afecta el desglose por proyecto (gráfico + "Total de proyectos") —
  // las horas asignadas/disponibles por persona sí incluyen tiempo
  // institucional siempre, porque consume su capacidad real igual que
  // cualquier otro proyecto.
  const [includeInstitutional, setIncludeInstitutional] = useState(false)

  const realProjects = useMemo(() => {
    const active = (projects ?? []).filter((x) => x.status !== "archivado")
    return includeInstitutional ? active : active.filter((x) => x.category !== "institucional")
  }, [projects, includeInstitutional])

  const metrics = useMemo(() => {
    const p = people ?? []
    return {
      totalPeople: p.length,
      totalProjects: realProjects.length,
      allocatedHours: p.reduce((sum, x) => sum + x.allocated_hours, 0),
      availableHours: p.reduce((sum, x) => sum + x.available_hours, 0),
    }
  }, [people, realProjects])

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
      <PageHeader
        icon={BarChart3}
        eyebrow="Planeación"
        title="Reportes"
        description={`Resumen ejecutivo de ${activeMonth?.name ?? "este mes"}.`}
        actions={
          <>
            <Button
              variant="outline"
              className="btn-press"
              onClick={handleExportExcel}
              disabled={isLoading || exporting !== null}
            >
              <FileSpreadsheet /> {exporting === "excel" ? "Exportando…" : "Excel"}
            </Button>
            <Button
              className="btn-press"
              onClick={handleExportPdf}
              disabled={isLoading || exporting !== null}
            >
              <FileText /> {exporting === "pdf" ? "Exportando…" : "PDF"}
            </Button>
          </>
        }
      />

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
            <div className="flex items-center gap-2 pt-1">
              <Switch
                id="include-institutional"
                checked={includeInstitutional}
                onCheckedChange={setIncludeInstitutional}
              />
              <Label htmlFor="include-institutional" className="text-xs font-normal text-muted-foreground">
                Incluir tiempo institucional
              </Label>
            </div>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading ? <Skeleton className="h-full w-full" /> : <ProjectHoursChart projects={realProjects} />}
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
