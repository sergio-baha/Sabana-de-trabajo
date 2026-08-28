import { useMemo, type CSSProperties } from "react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { barGeometry, buildRange, monthSegments } from "@/features/schedule/lib/scheduleRange"
import { PHASE_STATUS_LABEL } from "@/features/projects/lib/projectLabels"
import type { PhaseTotals } from "@/features/projects/api/projectBudgetApi"
import type { Database } from "@/types/database.types"

type PhaseStatus = Database["public"]["Enums"]["phase_status"]

// El color dice el estado, no la fase: en una línea de tiempo lo que se
// busca de un vistazo es qué está en curso y qué se quedó atrás, no cuál es
// la fase 3.
const COLOR_ESTADO: Record<PhaseStatus, string> = {
  pendiente: "var(--muted-foreground)",
  en_curso: "var(--primary)",
  completada: "var(--success)",
}

const BADGE_ESTADO: Record<PhaseStatus, string> = {
  pendiente: "bg-muted text-muted-foreground",
  en_curso: "bg-accent text-accent-foreground",
  completada: "bg-success-muted text-success",
}

const horas = (valor: number) => `${valor % 1 === 0 ? valor : valor.toFixed(1)} h`

/**
 * Los momentos del proyecto en el tiempo.
 *
 * Es la "planeación aparte" del gestor: las fases cruzan meses y sus fechas
 * NO están atadas al mes activo de la sábana. Por eso vive en el proyecto y
 * no en el módulo de Cronograma, que es por mes.
 *
 * La conexión con la sábana está en la columna de horas: `allocated_hours`
 * son las horas que el equipo ya repartió contra esa fase, a través de las
 * actividades. O sea que la fase no es una etiqueta suelta — es el contenedor
 * al que se le puede preguntar cuánto trabajo lleva encima.
 */
export default function FasesTimeline({ fases }: { fases: PhaseTotals[] }) {
  // Una fase sin fechas no se puede dibujar en un eje temporal. En vez de
  // esconderla —desaparecería sin explicación— se lista aparte, que es
  // además la forma de ver que le falta planear.
  const { conFecha, sinFecha } = useMemo(() => {
    const conFecha: PhaseTotals[] = []
    const sinFecha: PhaseTotals[] = []
    for (const fase of fases) {
      if (fase.start_date || fase.end_date) conFecha.push(fase)
      else sinFecha.push(fase)
    }
    return { conFecha, sinFecha }
  }, [fases])

  const days = useMemo(
    () => buildRange(conFecha.flatMap((f) => [f.start_date, f.end_date])),
    [conFecha]
  )
  const meses = useMemo(() => monthSegments(days, es), [days])
  const hoy = useMemo(() => barGeometry(days, format(new Date(), "yyyy-MM-dd"), format(new Date(), "yyyy-MM-dd")), [days])

  if (fases.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Este proyecto todavía no tiene fases. Agrégalas para planear sus momentos en el tiempo.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {conFecha.length > 0 && (
        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            {/* Eje de meses */}
            <div className="flex border-b border-border">
              <div className="text-eyebrow w-52 shrink-0 px-2 py-2 text-muted-foreground">Fase</div>
              <div className="flex flex-1">
                {meses.map((mes) => (
                  <div
                    key={mes.clave}
                    className="text-eyebrow border-l border-border/50 py-2 text-center text-muted-foreground"
                    style={{ width: `${mes.ancho}%` }}
                  >
                    {mes.label}
                  </div>
                ))}
              </div>
              <div className="text-eyebrow w-28 shrink-0 px-2 py-2 text-right text-muted-foreground">
                Horas
              </div>
            </div>

            {conFecha.map((fase, indice) => {
              const geometria = barGeometry(days, fase.start_date, fase.end_date)
              const color = COLOR_ESTADO[fase.status]
              const soloUnaFecha = !fase.start_date || !fase.end_date

              return (
                <div
                  key={fase.phase_id}
                  className="row-enter flex items-center border-b border-border/50 last:border-b-0"
                  style={{ "--i": indice } as CSSProperties}
                >
                  <div className="flex w-52 shrink-0 flex-col gap-0.5 px-2 py-2.5">
                    <span className="truncate text-xs font-semibold">{fase.name}</span>
                    <Badge variant="ghost" className={`w-fit ${BADGE_ESTADO[fase.status]}`}>
                      {PHASE_STATUS_LABEL[fase.status]}
                    </Badge>
                  </div>

                  <div className="relative flex flex-1 self-stretch py-3">
                    {meses.map((mes) => (
                      <div
                        key={mes.clave}
                        aria-hidden
                        className="border-l border-border/50"
                        style={{ width: `${mes.ancho}%` }}
                      />
                    ))}
                    {hoy && (
                      <div
                        aria-hidden
                        className="absolute inset-y-0 w-px bg-primary/50"
                        style={{ left: `${hoy.left}%` }}
                      />
                    )}
                    {geometria && (
                      <div
                        className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full"
                        style={{
                          left: `${geometria.left}%`,
                          width: `${geometria.width}%`,
                          background: color,
                          // Una fase con una sola fecha se dibuja como un
                          // punto de un día; el borde punteado avisa que el
                          // tramo no está definido, en vez de mentir con una
                          // barra que parece exacta.
                          ...(soloUnaFecha
                            ? { outline: `1px dashed ${color}`, outlineOffset: "2px" }
                            : {}),
                        }}
                        title={`${fase.name} · ${
                          fase.start_date
                            ? format(parseISO(fase.start_date), "PPP", { locale: es })
                            : "sin inicio"
                        } → ${
                          fase.end_date
                            ? format(parseISO(fase.end_date), "PPP", { locale: es })
                            : "sin fin"
                        }`}
                      />
                    )}
                  </div>

                  {/* La conexión con la sábana: horas repartidas contra el
                      techo de la fase, si lo tiene. */}
                  <div className="w-28 shrink-0 px-2 py-2.5 text-right">
                    <span className="text-xs font-semibold tabular-nums">
                      {horas(fase.allocated_hours)}
                    </span>
                    {fase.budget_hours !== null && (
                      <span className="block text-[10px] text-muted-foreground tabular-nums">
                        de {horas(fase.budget_hours)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {sinFecha.length > 0 && (
        <div className="rounded-xl border border-dashed border-border p-3">
          <p className="text-eyebrow flex items-center gap-1.5 text-muted-foreground">
            <CalendarOff aria-hidden className="size-3.5" />
            Sin fechas · no se pueden ubicar en el tiempo
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {sinFecha.map((fase) => (
              <li key={fase.phase_id}>
                <Badge variant="ghost" className={BADGE_ESTADO[fase.status]}>
                  {fase.name}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
