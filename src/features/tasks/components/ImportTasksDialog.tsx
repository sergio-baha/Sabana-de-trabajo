import { useState } from "react"
import { AlertTriangle, Download, FileSpreadsheet, Upload } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { downloadTaskImportTemplate } from "@/features/tasks/lib/taskImportTemplate"
import { buildTaskInserts, parseTaskImportFile, type ImportedTaskRow } from "@/features/tasks/lib/taskImport"
import { STATUS_LABELS, PRIORITY_LABELS } from "@/features/tasks/lib/taskLabels"
import { useBulkCreateTasks } from "@/features/tasks/hooks/useTasksQueries"
import type { Task } from "@/features/tasks/api/tasksApi"
import type { ProjectPhase } from "@/features/portfolio/api/portfolioApi"
import type { Person } from "@/features/people/api/peopleApi"

interface ImportTasksDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  monthId: string
  projectId: string
  projectName: string
  phases: ProjectPhase[]
  people: Person[]
  existingTasks: Task[]
}

// Cargue masivo desde Excel: descargar plantilla → llenarla en el proyecto
// real → subirla acá. El parseo y el match de Fase/Estado/Prioridad/
// Responsable pasa por src/features/tasks/lib/taskImport.ts; este
// componente solo maneja el estado del diálogo y la vista previa.
export default function ImportTasksDialog({
  open,
  onOpenChange,
  monthId,
  projectId,
  projectName,
  phases,
  people,
  existingTasks,
}: ImportTasksDialogProps) {
  const bulkCreate = useBulkCreateTasks(monthId)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [rows, setRows] = useState<ImportedTaskRow[]>([])
  const [fileErrors, setFileErrors] = useState<string[]>([])

  const reset = () => {
    setFileName(null)
    setRows([])
    setFileErrors([])
  }

  const handleFile = async (file: File) => {
    setFileName(file.name)
    setParsing(true)
    setRows([])
    setFileErrors([])
    try {
      const result = await parseTaskImportFile(file, phases, people)
      setRows(result.rows)
      setFileErrors(result.fileErrors)
    } catch (err) {
      setFileErrors([
        err instanceof Error ? err.message : "No se pudo leer el archivo. ¿Es un .xlsx válido?",
      ])
    } finally {
      setParsing(false)
    }
  }

  const handleImport = async () => {
    const inserts = buildTaskInserts(rows, {
      monthId,
      projectId,
      phases,
      people,
      existingTasks,
    })
    await bulkCreate.mutateAsync(inserts)
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar tareas desde Excel</DialogTitle>
          <DialogDescription>
            Descarga la plantilla, llénala con las tareas del proyecto y súbela aquí. Fase,
            Estado, Prioridad y Responsable se reconocen por texto — usa la hoja "Valores
            válidos" de la plantilla para copiar los nombres exactos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                downloadTaskImportTemplate(
                  projectName,
                  phases.map((p) => p.name),
                  people.map((p) => p.name)
                )
              }
            >
              <Download /> Descargar plantilla
            </Button>
            <Button type="button" variant="secondary" asChild>
              <label className="cursor-pointer">
                <Upload /> {fileName ?? "Elegir archivo .xlsx"}
                <input
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ""
                    if (file) void handleFile(file)
                  }}
                />
              </label>
            </Button>
          </div>

          {parsing && (
            <p className="text-sm text-muted-foreground">Leyendo el archivo…</p>
          )}

          {fileErrors.length > 0 && (
            <div className="flex flex-col gap-1 rounded-lg border border-danger/40 bg-danger-muted/40 p-3 text-sm">
              <div className="flex items-center gap-1.5 font-medium text-danger">
                <AlertTriangle className="size-4" /> {fileErrors.length} fila
                {fileErrors.length === 1 ? "" : "s"} con error — no se van a importar
              </div>
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                {fileErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {rows.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-sm">
                <FileSpreadsheet className="size-4 text-muted-foreground" />
                <span className="font-medium">{rows.length}</span>
                <span className="text-muted-foreground">
                  tarea{rows.length === 1 ? "" : "s"} lista{rows.length === 1 ? "" : "s"} para
                  importar
                </span>
              </div>
              <ScrollArea className="h-72 rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Fase</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Prioridad</TableHead>
                      <TableHead>Responsable</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.rowNumber}>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{row.title}</span>
                            {row.warnings.length > 0 && (
                              <span className="flex items-start gap-1 text-xs text-warning">
                                <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                                {row.warnings.join(" · ")}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.phaseName ?? "Sin fase"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{STATUS_LABELS[row.status]}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{PRIORITY_LABELS[row.priority]}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.assigneeName ?? "Sin asignar"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            disabled={rows.length === 0 || bulkCreate.isPending}
            onClick={() => void handleImport()}
          >
            {bulkCreate.isPending
              ? "Importando…"
              : `Importar ${rows.length || ""} tarea${rows.length === 1 ? "" : "s"}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
