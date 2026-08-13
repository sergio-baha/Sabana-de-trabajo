import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface AvailableHoursCellProps {
  personId: string
  personName: string
  hours: number
  canEdit: boolean
  onSave: (hours: number) => void
}

// Celda de "Disponible" en la fila de resumen de la grilla: las horas que la
// persona tiene ese mes, que son el denominador del semáforo.
//
// Va como input suelto y no por el editor de react-data-grid porque las filas
// de resumen no entran en su flujo de edición: no son filas de datos. El
// guardado es al salir del campo o con Enter — mismo autoguardado silencioso
// que las celdas de horas, sin botón.
export default function AvailableHoursCell({
  personId,
  personName,
  hours,
  canEdit,
  onSave,
}: AvailableHoursCellProps) {
  const [draft, setDraft] = useState(String(hours))

  // Si el valor cambia por fuera (otra pestaña, realtime, cambio de mes), el
  // campo tiene que seguirlo mientras no se esté editando.
  useEffect(() => {
    setDraft(String(hours))
  }, [hours, personId])

  if (!canEdit) {
    return (
      <div className="flex h-full items-center justify-end px-2 tabular-nums text-muted-foreground">
        {hours}
      </div>
    )
  }

  const commit = () => {
    const parsed = Number(draft.replace(",", "."))
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraft(String(hours))
      return
    }
    if (parsed !== hours) onSave(parsed)
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      aria-label={`Horas disponibles de ${personName}`}
      title={`Horas disponibles de ${personName} este mes`}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur()
        } else if (e.key === "Escape") {
          setDraft(String(hours))
          e.currentTarget.blur()
        }
      }}
      className={cn(
        "h-full w-full bg-transparent px-2 text-right tabular-nums text-muted-foreground",
        "rounded-sm outline-none hover:bg-accent/60 focus:bg-card focus:text-foreground",
        "focus:ring-2 focus:ring-ring"
      )}
    />
  )
}
