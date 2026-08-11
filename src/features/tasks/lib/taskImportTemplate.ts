import writeXlsxFile from "write-excel-file/browser"
import type { Row } from "write-excel-file/browser"
import { STATUS_LABELS, PRIORITY_LABELS } from "@/features/tasks/lib/taskLabels"

export const TASK_IMPORT_HEADERS = [
  "Título",
  "Fase",
  "Estado",
  "Prioridad",
  "Responsable",
  "Fecha inicio",
  "Fecha vencimiento",
  "Notas",
] as const

function headerRow(labels: string[]): Row {
  return labels.map((label) => ({ type: String, value: label, fontWeight: "bold" as const }))
}

// Plantilla con dos hojas: "Tareas" para llenar (con una fila de ejemplo
// que se puede borrar) y "Valores válidos" de solo lectura, para copiar y
// pegar Fase/Estado/Prioridad/Responsable sin errores de tipeo — la
// importación hace match por texto, no por posición.
export async function downloadTaskImportTemplate(
  projectName: string,
  phaseNames: string[],
  teamNames: string[]
) {
  const taskRows: Row[] = [
    headerRow([...TASK_IMPORT_HEADERS]),
    [
      { type: String, value: "Ejemplo: escribir el brief del taller" },
      { type: String, value: phaseNames[0] ?? "" },
      { type: String, value: "Pendiente" },
      { type: String, value: "Media" },
      { type: String, value: teamNames[0] ?? "" },
      { type: String, value: "" },
      { type: String, value: "" },
      { type: String, value: "Borra esta fila antes de importar" },
    ],
  ]

  const maxRows = Math.max(phaseNames.length, teamNames.length, Object.keys(STATUS_LABELS).length, 4)
  const statusLabels = Object.values(STATUS_LABELS)
  const priorityLabels = Object.values(PRIORITY_LABELS).map((l) => l.split(" · ")[1])

  const validValuesRows: Row[] = [
    headerRow(["Fases del proyecto", "Estados", "Prioridades", "Personas del equipo"]),
    ...Array.from({ length: maxRows }, (_, i) => [
      { type: String, value: phaseNames[i] ?? "" },
      { type: String, value: statusLabels[i] ?? "" },
      { type: String, value: priorityLabels[i] ?? "" },
      { type: String, value: teamNames[i] ?? "" },
    ] as Row),
  ]

  await writeXlsxFile(
    [
      { sheet: "Tareas", data: taskRows, columns: [{ width: 40 }, { width: 16 }, { width: 14 }, { width: 12 }, { width: 20 }, { width: 14 }, { width: 16 }, { width: 30 }] },
      { sheet: "Valores válidos", data: validValuesRows, columns: [{ width: 20 }, { width: 16 }, { width: 14 }, { width: 20 }] },
    ],
    { fontFamily: "Calibri" }
  ).toFile(`Plantilla tareas - ${projectName}.xlsx`)
}
