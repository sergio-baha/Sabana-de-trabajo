import { useMemo, useState, type CSSProperties } from "react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarClock } from "lucide-react"
import EmptyState from "@/components/shared/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { buildRange, barGeometry } from "@/features/schedule/lib/scheduleRange"
import {
  useProductoItems,
  useProductos,
} from "@/features/estratega/hooks/useGobernanzaQueries"
import {
  CELULA_LABEL,
  URGENCIA_LABEL,
  calcularUrgencia,
  type Urgencia,
} from "@/features/estratega/lib/gobernanza"
import ProductoPanel from "@/features/estratega/components/pipeline/ProductoPanel"
import ProductoFormDialog from "@/features/estratega/components/pipeline/ProductoFormDialog"
import type { Producto } from "@/features/estratega/api/gobernanzaApi"

const hoyIso = () => format(new Date(), "yyyy-MM-dd")

const COLOR_URGENCIA: Record<Urgencia, string> = {
  vencido: "var(--danger)",
  riesgo: "var(--primary)",
  lanzado: "var(--success)",
  en_fecha: "var(--viz-1)",
}

// Cronograma del pipeline: cuándo sale al mercado cada iniciativa.
//
// NO ES UN GANTT, y la diferencia importa. Un Gantt dibuja duraciones, y una
// iniciativa aquí tiene UNA sola fecha: la de salida comprometida. No hay
// fecha de inicio en el dato —`created_at` es cuándo se registró la fila, que
// para las siete iniciativas sembradas es el día en que se corrió la
// migración, no cuándo arrancó el trabajo—, así que dibujar una barra de
// "duración" sería inventarse el dato.
//
// Lo que sí es real y es lo que importa mirar: la distancia entre HOY y la
// fecha comprometida. Por eso la barra va de hoy al deadline (margen que
// queda) o del deadline a hoy (retraso acumulado), y el rombo marca la fecha
// exacta. La barra tiene una unidad honesta: días.
export default function CronogramaTab() {
  const { data: productos, isLoading: cargandoProductos } = useProductos()
  const { data: items, isLoading: cargandoItems } = useProductoItems()

  const [productoAbierto, setProductoAbierto] = useState<Producto | null>(null)
  const [productoEnEdicion, setProductoEnEdicion] = useState<Producto | null>(null)
  const [formAbierto, setFormAbierto] = useState(false)

  const hoy = hoyIso()

  // Avance por producto, para el porcentaje de cada fila y para decidir si una
  // iniciativa ya está lanzada (que cambia su semáforo).
  const avances = useMemo(() => {
    const mapa = new Map<string, { hechos: number; totales: number }>()
    for (const item of items ?? []) {
      const actual = mapa.get(item.producto_id) ?? { hechos: 0, totales: 0 }
      actual.totales += 1
      if (item.completado) actual.hechos += 1
      mapa.set(item.producto_id, actual)
    }
    return mapa
  }, [items])

  const filas = useMemo(() => {
    return (productos ?? [])
      .map((producto) => {
        const avance = avances.get(producto.id) ?? { hechos: 0, totales: 0 }
        return {
          producto,
          avance,
          porcentaje:
            avance.totales > 0 ? Math.round((avance.hechos / avance.totales) * 100) : 0,
          estado: calcularUrgencia(producto.fecha_limite, avance.hechos, avance.totales),
        }
      })
      .sort((a, b) => a.producto.fecha_limite.localeCompare(b.producto.fecha_limite))
  }, [productos, avances])

  // El eje incluye HOY además de todas las fechas límite: sin eso, un
  // portafolio cuyas fechas ya pasaron dibujaría la línea de hoy fuera del
  // rango visible y no se vería contra qué se está midiendo el retraso.
  const days = useMemo(
    () => buildRange([hoy, ...filas.map((f) => f.producto.fecha_limite)]),
    [filas, hoy]
  )

  // Cabecera por mes, no por día: el portafolio abarca casi un año y una
  // columna por día daría trescientas etiquetas ilegibles.
  const meses = useMemo(() => {
    const grupos: { clave: string; label: string; dias: number }[] = []
    for (const day of days) {
      const clave = day.iso.slice(0, 7)
      const ultimo = grupos[grupos.length - 1]
      if (ultimo?.clave === clave) ultimo.dias += 1
      else {
        grupos.push({
          clave,
          label: format(day.date, "LLL yy", { locale: es }),
          dias: 1,
        })
      }
    }
    return grupos
  }, [days])

  const geometriaHoy = useMemo(() => barGeometry(days, hoy, hoy), [days, hoy])

  const resumen = useMemo(() => {
    const conteo: Record<Urgencia, number> = { vencido: 0, riesgo: 0, en_fecha: 0, lanzado: 0 }
    for (const fila of filas) conteo[fila.estado.codigo] += 1
    return conteo
  }, [filas])

  if (cargandoProductos || cargandoItems) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (filas.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Sin iniciativas en el pipeline"
        description="Agrega una iniciativa desde la pestaña de Pipeline comercial y aparecerá aquí con su fecha de salida."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Leyenda: dice qué significa cada color y, de paso, cuántas hay en
          cada estado. Sin ella la barra roja se lee como "avance", que es
          justo lo contrario de lo que significa. */}
      <div className="filter-bar">
        {(["vencido", "riesgo", "en_fecha", "lanzado"] as Urgencia[]).map((codigo) => (
          <span key={codigo} className="flex items-center gap-2 px-1 text-xs">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: COLOR_URGENCIA[codigo] }}
            />
            <span className="text-muted-foreground">{URGENCIA_LABEL[codigo]}</span>
            <span className="font-bold tabular-nums">{resumen[codigo]}</span>
          </span>
        ))}
        <span className="text-eyebrow ml-auto text-muted-foreground">
          La barra mide días entre hoy y la fecha comprometida
        </span>
      </div>

      <section className="surface-section overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            {/* ── Cabecera de meses ─────────────────────────────────────── */}
            <div className="flex border-b border-border">
              <div className="text-eyebrow w-64 shrink-0 px-3 py-2 text-muted-foreground">
                Iniciativa
              </div>
              <div className="relative flex flex-1">
                {meses.map((mes) => (
                  <div
                    key={mes.clave}
                    className="text-eyebrow border-l border-border/50 py-2 text-center text-muted-foreground"
                    style={{ width: `${(mes.dias / days.length) * 100}%` }}
                  >
                    {mes.label}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Filas ─────────────────────────────────────────────────── */}
            {filas.map((fila, indice) => {
              const vencido = fila.estado.codigo === "vencido"
              const lanzado = fila.estado.codigo === "lanzado"
              const color = COLOR_URGENCIA[fila.estado.codigo]

              // El tramo va de hoy al deadline, o del deadline a hoy si ya
              // pasó. Una iniciativa lanzada no lleva tramo: no le queda
              // margen ni acumula retraso, ya salió.
              const tramo = lanzado
                ? null
                : barGeometry(
                    days,
                    vencido ? fila.producto.fecha_limite : hoy,
                    vencido ? hoy : fila.producto.fecha_limite
                  )
              const hito = barGeometry(
                days,
                fila.producto.fecha_limite,
                fila.producto.fecha_limite
              )

              return (
                <div
                  key={fila.producto.id}
                  className="row-enter flex items-center border-b border-border/50 last:border-b-0"
                  style={{ "--i": indice } as CSSProperties}
                >
                  <button
                    type="button"
                    onClick={() => setProductoAbierto(fila.producto)}
                    className="flex w-64 shrink-0 flex-col items-start gap-0.5 px-3 py-2.5 text-left"
                  >
                    <span className="truncate text-xs font-bold hover:underline">
                      {fila.producto.nombre}
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      {CELULA_LABEL[fila.producto.celula]}
                      <span aria-hidden>·</span>
                      <span className="font-semibold tabular-nums" style={{ color }}>
                        {fila.porcentaje}%
                      </span>
                    </span>
                  </button>

                  <div className="relative flex flex-1 self-stretch py-3">
                    {/* Rejilla de meses, para poder ubicar una barra sin
                        seguir la línea hasta la cabecera. */}
                    {meses.map((mes) => (
                      <div
                        key={mes.clave}
                        aria-hidden
                        className="border-l border-border/50"
                        style={{ width: `${(mes.dias / days.length) * 100}%` }}
                      />
                    ))}

                    {/* Línea de hoy, detrás de las barras. */}
                    {geometriaHoy && (
                      <div
                        aria-hidden
                        className="absolute inset-y-0 w-px bg-primary/50"
                        style={{ left: `${geometriaHoy.left}%` }}
                      />
                    )}

                    {tramo && (
                      <div
                        className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full"
                        style={{
                          left: `${tramo.left}%`,
                          width: `${tramo.width}%`,
                          // Degradado hacia el hito: el extremo del deadline
                          // es el que se lee como "el punto al que se llega".
                          background: `linear-gradient(${
                            vencido ? "270deg" : "90deg"
                          }, color-mix(in oklch, ${color} 25%, transparent), ${color})`,
                        }}
                      />
                    )}

                    {/* Rombo en la fecha comprometida. Va siempre, incluso en
                        las lanzadas: es el dato duro de la fila. */}
                    {hito && (
                      <div
                        className="absolute top-1/2 z-1 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border-2 border-card"
                        style={{ left: `${hito.left + hito.width / 2}%`, background: color }}
                        title={`${fila.producto.nombre} · ${format(
                          parseISO(fila.producto.fecha_limite),
                          "PPP",
                          { locale: es }
                        )} · ${fila.estado.label}`}
                      />
                    )}
                  </div>

                  <div className="w-36 shrink-0 px-3 py-2.5 text-right">
                    <span
                      className={`text-eyebrow rounded-full px-2 py-0.5 ${fila.estado.badge}`}
                    >
                      {fila.estado.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {productoAbierto && (
        <ProductoPanel
          producto={(productos ?? []).find((p) => p.id === productoAbierto.id) ?? null}
          items={items ?? []}
          onOpenChange={(abierto) => !abierto && setProductoAbierto(null)}
          onEditar={(producto) => {
            setProductoEnEdicion(producto)
            setFormAbierto(true)
          }}
        />
      )}

      <ProductoFormDialog
        open={formAbierto}
        onOpenChange={setFormAbierto}
        producto={productoEnEdicion}
      />
    </div>
  )
}
