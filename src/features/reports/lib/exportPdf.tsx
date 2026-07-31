import { pdf } from "@react-pdf/renderer"
import ReportPdfDocument from "@/features/reports/components/ReportPdfDocument"
import type { PersonMonthTotal, ProjectMonthTotal } from "@/features/dashboard/api/dashboardApi"
import type { ManagerMonthTotal } from "@/features/reports/api/reportsApi"

interface ExportParams {
  companyName: string
  monthName: string
  people: PersonMonthTotal[]
  projects: ProjectMonthTotal[]
  managers: ManagerMonthTotal[]
}

export async function exportReportToPdf(params: ExportParams) {
  const blob = await pdf(<ReportPdfDocument {...params} generatedAt={new Date()} />).toBlob()

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `Reporte ${params.monthName}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
