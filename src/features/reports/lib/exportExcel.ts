import writeXlsxFile from "write-excel-file/browser"
import type { Row } from "write-excel-file/browser"
import type { PersonMonthTotal, ProjectMonthTotal } from "@/features/dashboard/api/dashboardApi"
import type { ManagerMonthTotal } from "@/features/reports/api/reportsApi"

interface ExportParams {
  monthName: string
  people: PersonMonthTotal[]
  projects: ProjectMonthTotal[]
  managers: ManagerMonthTotal[]
}

// El modo "multi-hoja" de write-excel-file trabaja con SheetData cruda
// (Row[] = Cell[][]), no con el helper de columnas con `header` (ese solo
// existe para una sola hoja de objetos) — por eso cada hoja arma su propia
// fila de encabezado a mano como primera fila.
function headerRow(labels: string[]): Row {
  return labels.map((label) => ({ type: String, value: label, fontWeight: "bold" as const }))
}

export async function exportReportToExcel({ monthName, people, projects, managers }: ExportParams) {
  const peopleRows: Row[] = [
    headerRow(["Persona", "Cargo", "Horas disponibles", "Horas asignadas", "% Utilización", "Estado"]),
    ...people.map<Row>((p) => [
      { type: String, value: p.name },
      { type: String, value: p.job_title ?? "" },
      { type: Number, value: p.available_hours },
      { type: Number, value: p.allocated_hours },
      {
        type: Number,
        value: p.available_hours > 0 ? Math.round((p.allocated_hours / p.available_hours) * 100) : 0,
      },
      { type: String, value: p.status_color },
    ]),
  ]

  const projectRows: Row[] = [
    headerRow(["Proyecto", "Estado", "Horas asignadas", "Personas"]),
    ...projects.map<Row>((p) => [
      { type: String, value: p.name },
      { type: String, value: p.status },
      { type: Number, value: p.allocated_hours },
      { type: Number, value: p.people_count },
    ]),
  ]

  const managerRows: Row[] = [
    headerRow(["Gerente", "Horas bajo su gestión", "Proyectos"]),
    ...managers.map<Row>((m) => [
      { type: String, value: m.manager_name },
      { type: Number, value: m.allocated_hours },
      { type: Number, value: m.projects_count },
    ]),
  ]

  await writeXlsxFile(
    [
      { sheet: "Personas", data: peopleRows, columns: [{ width: 26 }, { width: 22 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 12 }] },
      { sheet: "Proyectos", data: projectRows, columns: [{ width: 26 }, { width: 14 }, { width: 16 }, { width: 12 }] },
      { sheet: "Gerentes", data: managerRows, columns: [{ width: 26 }, { width: 20 }, { width: 12 }] },
    ],
    { fontFamily: "Calibri" }
  ).toFile(`Reporte ${monthName}.xlsx`)
}
