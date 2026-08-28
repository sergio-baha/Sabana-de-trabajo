import {
  addDays,
  format as formatDate,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isWeekend,
  parseISO,
  startOfMonth,
} from "date-fns"
import type { Locale } from "date-fns"

export interface ScheduleDay {
  iso: string
  date: Date
  isWeekend: boolean
  isToday: boolean
}

const todayIso = () => format(new Date(), "yyyy-MM-dd")

// El mes de trabajo (`months`) es un nombre de texto, no un rango de fechas:
// el esquema nunca guardó día de inicio y fin. Así que el eje temporal del
// cronograma se deriva de los datos que sí tienen fecha (tareas y
// actividades) y, cuando no hay ninguno, se cae al mes natural en curso —
// que es lo que el usuario espera ver al abrir un cronograma vacío.
export function buildRange(dates: (string | null)[]): ScheduleDay[] {
  const valid = dates.filter((d): d is string => Boolean(d)).sort()

  let start: Date
  let end: Date

  if (valid.length === 0) {
    const now = new Date()
    start = startOfMonth(now)
    end = endOfMonth(now)
  } else {
    start = parseISO(valid[0])
    end = parseISO(valid[valid.length - 1])
  }

  // Un rango de un solo día se ve como una columna suelta; se ensancha al
  // mes natural que lo contiene para dar contexto.
  if (differenceInCalendarDays(end, start) < 6) {
    start = startOfMonth(start)
    end = endOfMonth(end)
  }

  const total = differenceInCalendarDays(end, start) + 1
  const today = todayIso()

  return Array.from({ length: total }, (_, i) => {
    const date = addDays(start, i)
    const iso = format(date, "yyyy-MM-dd")
    return { iso, date, isWeekend: isWeekend(date), isToday: iso === today }
  })
}

export interface DueDateConflict {
  taskA: { id: string; title: string; startIso: string; endIso: string }
  taskB: { id: string; title: string; startIso: string; endIso: string }
}

// Dos tareas "se cruzan" cuando sus ventanas [start_date, due_date] se
// superponen: la persona tendría que entregar ambas a la vez. Es solo
// informativo (no bloquea nada) — el gestor decide si reordena, reasigna o
// lo deja así. Una tarea sin due_date no entra en la comparación: sin fecha
// de entrega no hay con qué cruzarse.
export function findDueDateConflicts(
  tasks: { id: string; title: string; start_date: string | null; due_date: string | null }[]
): DueDateConflict[] {
  const dated = tasks
    .filter((t) => t.due_date)
    .map((t) => ({
      id: t.id,
      title: t.title,
      startIso: t.start_date ?? t.due_date!,
      endIso: t.due_date!,
    }))

  const conflicts: DueDateConflict[] = []
  for (let i = 0; i < dated.length; i++) {
    for (let j = i + 1; j < dated.length; j++) {
      const a = dated[i]
      const b = dated[j]
      const overlap = a.startIso <= b.endIso && b.startIso <= a.endIso
      if (overlap) conflicts.push({ taskA: a, taskB: b })
    }
  }
  return conflicts
}

export interface MonthSegment {
  clave: string
  label: string
  /** Días que ocupa el mes dentro del rango, para calcular su ancho. */
  dias: number
  /** Ancho en porcentaje del eje. */
  ancho: number
}

// Agrupa el rango en meses. Un cronograma de días sirve para un mes de
// tareas; cuando el rango abarca medio año —fases de proyecto, fechas de
// lanzamiento— una columna por día son trescientas etiquetas ilegibles y lo
// que se necesita es el mes.
export function monthSegments(days: ScheduleDay[], locale: Locale): MonthSegment[] {
  const grupos: MonthSegment[] = []
  for (const day of days) {
    const clave = day.iso.slice(0, 7)
    const ultimo = grupos[grupos.length - 1]
    if (ultimo?.clave === clave) {
      ultimo.dias += 1
    } else {
      grupos.push({
        clave,
        label: formatDate(day.date, "LLL yy", { locale }),
        dias: 1,
        ancho: 0,
      })
    }
  }
  for (const grupo of grupos) grupo.ancho = (grupo.dias / days.length) * 100
  return grupos
}

// Posición de una barra del Gantt dentro del rango, en porcentaje. Se
// recorta a los extremos para que una tarea que empieza antes o termina
// después del rango visible siga dibujándose (truncada) en vez de
// desbordar el contenedor.
export function barGeometry(
  days: ScheduleDay[],
  startIso: string | null,
  endIso: string | null
): { left: number; width: number } | null {
  if (days.length === 0) return null

  const first = days[0].iso
  const last = days[days.length - 1].iso
  const from = startIso ?? endIso
  const to = endIso ?? startIso
  if (!from || !to) return null

  // Fuera del rango por completo.
  if (to < first || from > last) return null

  const clampedFrom = from < first ? first : from
  const clampedTo = to > last ? last : to

  const startIndex = days.findIndex((d) => d.iso === clampedFrom)
  const endIndex = days.findIndex((d) => d.iso === clampedTo)
  if (startIndex === -1 || endIndex === -1) return null

  const unit = 100 / days.length
  return {
    left: startIndex * unit,
    width: (endIndex - startIndex + 1) * unit,
  }
}
