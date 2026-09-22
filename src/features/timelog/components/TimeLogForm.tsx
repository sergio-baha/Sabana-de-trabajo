import { useMemo, useState } from "react"
import { CalendarClock, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type {
  CalendarEvent,
  TimeLogEntry,
  TimeLogOption,
} from "@/features/timelog/api/timeLogApi"

// El valor del desplegable junta proyecto y línea en una sola cadena porque
// son una sola decisión para quien registra ("¿a qué le cargo esta hora?").
// Se parte al enviar. El separador es "|" y no un guion porque no aparece en
// ningún id.
const SIN_ASIGNAR = "sin-asignar"

function optionValue(option: TimeLogOption): string {
  return option.line_id ? `${option.project_id}|${option.line_id}` : option.project_id
}

function optionLabel(option: TimeLogOption): string {
  return option.line_name ? `${option.project_name} · ${option.line_name}` : option.project_name
}

interface Row {
  key: string
  value: string
  hours: string
  note: string
  /** Solo en las filas que nacieron de una reunión del calendario. */
  eventUid?: string
}

function newRow(): Row {
  return { key: crypto.randomUUID(), value: "", hours: "", note: "" }
}

function entryToRow(entry: TimeLogEntry): Row {
  return {
    key: crypto.randomUUID(),
    value: entry.project_id
      ? entry.line_id
        ? `${entry.project_id}|${entry.line_id}`
        : entry.project_id
      : SIN_ASIGNAR,
    hours: String(entry.hours),
    note: entry.note ?? "",
    eventUid: entry.calendar_event_id ?? undefined,
  }
}

// Una reunión entra al formulario como una fila más, ya llena: duración desde
// el calendario y proyecto sugerido si se reconoció. El asunto va en la nota,
// que es donde queda útil sin ensuciar el registro — y de una reunión privada
// no hay asunto que poner, solo la duración.
function eventToRow(event: CalendarEvent): Row {
  return {
    key: crypto.randomUUID(),
    // Sin sugerencia la fila queda con el desplegable vacío, no con uno
    // elegido al azar: que la persona elija es más barato que descubrir que
    // el sistema le cargó horas a un proyecto que no era.
    value:
      event.suggested_project_id && event.suggested_line_id
        ? `${event.suggested_project_id}|${event.suggested_line_id}`
        : "",
    hours: String(event.hours),
    note: event.is_private ? "Reunión privada" : (event.subject ?? ""),
    eventUid: event.event_uid,
  }
}

interface TimeLogFormProps {
  options: TimeLogOption[]
  initialEntries?: TimeLogEntry[]
  /** Reuniones del día que todavía no se registraron. */
  calendar?: CalendarEvent[]
  /** Horas que se esperan de un día normal de esta persona, si se conocen. */
  expectedHours?: number | null
  pending?: boolean
  onSubmit: (entries: TimeLogEntry[]) => void
}

export default function TimeLogForm({
  options,
  initialEntries = [],
  calendar = [],
  expectedHours,
  pending,
  onSubmit,
}: TimeLogFormProps) {
  // El orden importa: primero lo ya registrado (si vuelve a abrir el enlace
  // para corregir), después las reuniones que faltan. Una fila en blanco solo
  // cuando no hay nada de lo anterior, para que el formulario nunca abra
  // vacío del todo ni con una fila muerta al final.
  const [rows, setRows] = useState<Row[]>(() => {
    const iniciales = [...initialEntries.map(entryToRow), ...calendar.map(eventToRow)]
    return iniciales.length ? iniciales : [newRow()]
  })

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.hours) || 0), 0),
    [rows]
  )

  const patch = (key: string, field: keyof Row, value: string) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, [field]: value } : row))
    )

  const remove = (key: string) =>
    setRows((current) => (current.length === 1 ? [newRow()] : current.filter((r) => r.key !== key)))

  const submit = () => {
    const entries: TimeLogEntry[] = rows
      .filter((row) => Number(row.hours) > 0)
      .map((row) => {
        const [projectId, lineId] = row.value === SIN_ASIGNAR ? [] : row.value.split("|")
        return {
          project_id: projectId ?? null,
          line_id: lineId ?? null,
          hours: Number(row.hours),
          note: row.note.trim() || null,
          calendar_event_id: row.eventUid ?? null,
        }
      })
    onSubmit(entries)
  }

  const excede = total > 24
  const puedeEnviar = total > 0 && !excede && !pending

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.key} className="flex flex-col gap-1">
            {/* Se marca de dónde salió la fila. Sin esta señal, la persona ve
                horas que ella no escribió y no sabe si confiar en ellas; con
                ella entiende que son su propia agenda y las revisa en vez de
                borrarlas. */}
            {row.eventUid && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarClock className="size-3" /> De tu calendario — revisa y ajusta
              </span>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <Select value={row.value} onValueChange={(value) => patch(row.key, "value", value)}>
                <SelectTrigger className="sm:flex-1">
                  <SelectValue placeholder="¿En qué trabajaste?" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={optionValue(option)} value={optionValue(option)}>
                      {optionLabel(option)}
                    </SelectItem>
                  ))}
                  {/* Una hora que no se sabe a qué cargar entra igual. El
                      hueco honesto es mejor dato que un proyecto inventado
                      con tal de poder cerrar el día. */}
                  <SelectItem value={SIN_ASIGNAR}>Otra cosa (sin proyecto)</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={24}
                step={0.5}
                placeholder="Horas"
                className="sm:w-24"
                value={row.hours}
                onChange={(e) => patch(row.key, "hours", e.target.value)}
              />

              <Input
                placeholder="Nota (opcional)"
                className="sm:w-56"
                value={row.note}
                onChange={(e) => patch(row.key, "note", e.target.value)}
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Quitar esta línea"
                onClick={() => remove(row.key)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => setRows((current) => [...current, newRow()])}
      >
        <Plus className="size-4" /> Agregar línea
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div className="text-sm">
          <span className="text-muted-foreground">Total del día: </span>
          <span className={cn("font-semibold tabular-nums", excede && "text-destructive")}>
            {total.toFixed(1)} h
          </span>
          {/* Se informa, no se bloquea: registrar menos horas de las esperadas
              es un dato legítimo (medio día, incapacidad, un día flojo). Lo
              que no sirve para nada es el día sin registrar. */}
          {expectedHours ? (
            <span className="text-muted-foreground"> de {expectedHours} h esperadas</span>
          ) : null}
          {excede && (
            <p className="text-destructive">Un día no puede sumar más de 24 horas.</p>
          )}
        </div>

        <Button type="button" onClick={submit} disabled={!puedeEnviar}>
          {pending ? "Enviando…" : "Registrar"}
        </Button>
      </div>
    </div>
  )
}
