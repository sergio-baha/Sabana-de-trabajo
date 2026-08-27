import { useMemo, useState, type CSSProperties } from "react"
import { Download, LayoutGrid, Plus, RotateCcw, Search } from "lucide-react"
import writeXlsxFile from "write-excel-file/browser"
import type { Row } from "write-excel-file/browser"
import { toast } from "sonner"
import EmptyState from "@/components/shared/EmptyState"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useProductoItems,
  useProductos,
} from "@/features/estratega/hooks/useGobernanzaQueries"
import {
  CELULAS,
  CELULA_LABEL,
  FASES,
  FASE_COLOR,
  FASE_CORTA,
  FASE_LABEL,
  URGENCIA_LABEL,
  calcularUrgencia,
  pesoUrgencia,
  type Fase,
  type Urgencia,
} from "@/features/estratega/lib/gobernanza"
import ProductoPanel from "@/features/estratega/components/pipeline/ProductoPanel"
import ProductoFormDialog from "@/features/estratega/components/pipeline/ProductoFormDialog"
import type { Producto, ProductoItem } from "@/features/estratega/api/gobernanzaApi"

const TODAS = "TODAS"
const TODOS = "TODOS"

type Orden = "urgencia" | "fecha" | "cumplimiento" | "nombre"

interface Avance {
  hechos: number
  totales: number
  porFase: Record<Fase, { hechos: number; totales: number }>
}

const avanceVacio = (): Avance => ({
  hechos: 0,
  totales: 0,
  porFase: {
    descubrir: { hechos: 0, totales: 0 },
    definir: { hechos: 0, totales: 0 },
    desarrollar: { hechos: 0, totales: 0 },
    entregar: { hechos: 0, totales: 0 },
  },
})

const pct = (hechos: number, totales: number) =>
  totales > 0 ? Math.round((hechos / totales) * 100) : 0

// Pipeline comercial: en qué fase del Doble Diamante va cada iniciativa y
// cuánto le queda para su fecha de salida al mercado.
//
// El avance NO se guarda: se cuenta desde el checklist cada vez. Es lo que
// evita el problema del tablero original, donde el contador del producto y
// las casillas del detalle eran dos datos distintos que había que sincronizar
// a mano y que podían quedar diciendo cosas diferentes.
export default function PipelineTab() {
  const { data: productos, isLoading: cargandoProductos } = useProductos()
  const { data: items, isLoading: cargandoItems } = useProductoItems()

  const [busqueda, setBusqueda] = useState("")
  const [celula, setCelula] = useState<string>(TODAS)
  const [urgencia, setUrgencia] = useState<string>(TODOS)
  const [orden, setOrden] = useState<Orden>("urgencia")

  const [productoAbierto, setProductoAbierto] = useState<Producto | null>(null)
  const [productoEnEdicion, setProductoEnEdicion] = useState<Producto | null>(null)
  const [formAbierto, setFormAbierto] = useState(false)

  // Avance de cada producto, en una sola pasada por el checklist completo.
  const avances = useMemo(() => {
    const mapa = new Map<string, Avance>()
    for (const item of (items ?? []) as ProductoItem[]) {
      const avance = mapa.get(item.producto_id) ?? avanceVacio()
      avance.totales += 1
      avance.porFase[item.fase].totales += 1
      if (item.completado) {
        avance.hechos += 1
        avance.porFase[item.fase].hechos += 1
      }
      mapa.set(item.producto_id, avance)
    }
    return mapa
  }, [items])

  const conEstado = useMemo(
    () =>
      (productos ?? []).map((producto) => {
        const avance = avances.get(producto.id) ?? avanceVacio()
        return {
          producto,
          avance,
          estado: calcularUrgencia(producto.fecha_limite, avance.hechos, avance.totales),
        }
      }),
    [productos, avances]
  )

  // Los tres indicadores de cabecera se calculan sobre TODO el portafolio, no
  // sobre lo filtrado: son el estado de la empresa, y cambiarían al escribir
  // en el buscador si dependieran del filtro.
  const resumen = useMemo(() => {
    let vencidos = 0
    let riesgo = 0
    let lanzados = 0
    let hechos = 0
    let totales = 0
    for (const fila of conEstado) {
      if (fila.estado.codigo === "vencido") vencidos += 1
      else if (fila.estado.codigo === "riesgo") riesgo += 1
      else if (fila.estado.codigo === "lanzado") lanzados += 1
      hechos += fila.avance.hechos
      totales += fila.avance.totales
    }
    return { vencidos, riesgo, lanzados, indice: pct(hechos, totales) }
  }, [conEstado])

  const cargaPorFase = useMemo(
    () =>
      FASES.map((fase) => {
        let hechos = 0
        let totales = 0
        for (const fila of conEstado) {
          hechos += fila.avance.porFase[fase].hechos
          totales += fila.avance.porFase[fase].totales
        }
        return { fase, hechos, totales, porcentaje: pct(hechos, totales) }
      }),
    [conEstado]
  )

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    const lista = conEstado.filter((fila) => {
      if (texto && !fila.producto.nombre.toLowerCase().includes(texto)) return false
      if (celula !== TODAS && fila.producto.celula !== celula) return false
      if (urgencia !== TODOS && fila.estado.codigo !== urgencia) return false
      return true
    })

    return [...lista].sort((a, b) => {
      if (orden === "urgencia") return pesoUrgencia(b.estado.codigo) - pesoUrgencia(a.estado.codigo)
      if (orden === "fecha") return a.producto.fecha_limite.localeCompare(b.producto.fecha_limite)
      if (orden === "cumplimiento") {
        return pct(b.avance.hechos, b.avance.totales) - pct(a.avance.hechos, a.avance.totales)
      }
      return a.producto.nombre.localeCompare(b.producto.nombre)
    })
  }, [conEstado, busqueda, celula, urgencia, orden])

  const limpiarFiltros = () => {
    setBusqueda("")
    setCelula(TODAS)
    setUrgencia(TODOS)
    setOrden("urgencia")
  }

  // Excel y no CSV: el original bajaba un CSV separado por comas que Excel en
  // español abre en una sola columna. La app ya trae `write-excel-file` para
  // los reportes del mes, así que sale una hoja de verdad.
  const exportar = async () => {
    try {
      const encabezado: Row = [
        "Producto",
        "Célula",
        "Fecha límite",
        "Cumplimiento",
        "Entregables",
        "Estado",
      ].map((label) => ({ type: String, value: label, fontWeight: "bold" as const }))

      const filas: Row[] = filtrados.map((fila) => [
        { type: String, value: fila.producto.nombre },
        { type: String, value: CELULA_LABEL[fila.producto.celula] },
        { type: String, value: fila.producto.fecha_limite },
        // Fracción con formato de porcentaje, no el texto "83%": así la
        // columna se puede promediar y ordenar en la hoja.
        {
          type: Number,
          value: pct(fila.avance.hechos, fila.avance.totales) / 100,
          format: "0%",
        },
        { type: String, value: `${fila.avance.hechos}/${fila.avance.totales}` },
        { type: String, value: URGENCIA_LABEL[fila.estado.codigo] },
      ])

      // Misma forma de llamada que `exportExcel` del módulo de Reportes: la
      // variante de hojas con nombre, que es la única que TypeScript resuelve
      // sin ambigüedad (la de una sola hoja choca con la sobrecarga que
      // espera objetos), y `.toFile` para disparar la descarga.
      await writeXlsxFile(
        [
          {
            sheet: "Pipeline",
            data: [encabezado, ...filas],
            columns: [
              { width: 30 },
              { width: 20 },
              { width: 14 },
              { width: 14 },
              { width: 14 },
              { width: 18 },
            ],
          },
        ],
        { fontFamily: "Calibri" }
      ).toFile("Gobernanza-Pipeline.xlsx")
      toast.success("Reporte de gobernanza exportado.")
    } catch (error) {
      toast.error((error as Error).message)
    }
  }

  const abrirNuevo = () => {
    setProductoEnEdicion(null)
    setFormAbierto(true)
  }

  if (cargandoProductos || cargandoItems) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Índice de lanzamiento ─────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Índice de lanzamiento",
            valor: `${resumen.indice}%`,
            pie: "Entregables certificados del portafolio",
            color: "var(--primary)",
          },
          {
            label: "Fuera de SLA",
            valor: String(resumen.vencidos),
            pie: "Iniciativas vencidas sin lanzar",
            color: "var(--danger)",
          },
          {
            label: "Riesgo alto",
            valor: String(resumen.riesgo),
            pie: "A 30 días o menos de su fecha",
            color: "var(--warning)",
          },
          {
            label: "En mercado",
            valor: String(resumen.lanzados),
            pie: "Con las cuatro fases completas",
            color: "var(--success)",
          },
        ].map((kpi, indice) => (
          <div
            key={kpi.label}
            className="surface-section stagger-item card-lift relative overflow-hidden p-5"
            style={{ "--i": indice } as CSSProperties}
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-1"
              style={{ background: kpi.color }}
            />
            <span className="text-eyebrow text-muted-foreground">{kpi.label}</span>
            <p
              className="text-display mt-1 text-2xl font-black tabular-nums"
              style={{ color: kpi.color }}
            >
              {kpi.valor}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{kpi.pie}</p>
          </div>
        ))}
      </div>

      {/* ── Carga operativa por fase ──────────────────────────────────── */}
      <section className="surface-section p-5">
        <h2 className="text-sm font-bold">Carga operativa por fase</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Avance agregado del portafolio activo, fase por fase.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cargaPorFase.map((carga, indice) => (
            <div key={carga.fase} className="stagger-item" style={{ "--i": indice } as CSSProperties}>
              <div className="flex items-center justify-between">
                <span className="text-eyebrow" style={{ color: FASE_COLOR[carga.fase] }}>
                  {FASE_CORTA[carga.fase]} · {FASE_LABEL[carga.fase]}
                </span>
                <span
                  className="text-eyebrow tabular-nums"
                  style={{ color: FASE_COLOR[carga.fase] }}
                >
                  {carga.porcentaje}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="animate-bar h-full rounded-full"
                  style={{ width: `${carga.porcentaje}%`, background: FASE_COLOR[carga.fase] }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                {carga.hechos} de {carga.totales} entregables
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Filtros ───────────────────────────────────────────────────── */}
      <div className="filter-bar">
        <div className="relative min-w-52 flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar iniciativa…"
            className="pl-8"
            aria-label="Buscar iniciativa"
          />
        </div>

        <Select value={celula} onValueChange={setCelula}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas las células</SelectItem>
            {CELULAS.map((c) => (
              <SelectItem key={c} value={c}>
                {CELULA_LABEL[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={urgencia} onValueChange={setUrgencia}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los estados</SelectItem>
            {(Object.keys(URGENCIA_LABEL) as Urgencia[]).map((codigo) => (
              <SelectItem key={codigo} value={codigo}>
                {URGENCIA_LABEL[codigo]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={orden} onValueChange={(valor) => setOrden(valor as Orden)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="urgencia">Mayor urgencia</SelectItem>
            <SelectItem value="fecha">Fecha de SLA</SelectItem>
            <SelectItem value="cumplimiento">% de cumplimiento</SelectItem>
            <SelectItem value="nombre">Alfabético</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-eyebrow text-muted-foreground">
            {filtrados.length} de {conEstado.length}
          </span>
          <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
            <RotateCcw />
            Limpiar
          </Button>
          <Button variant="outline" size="sm" onClick={exportar} disabled={filtrados.length === 0}>
            <Download />
            Exportar
          </Button>
          <Button size="sm" onClick={abrirNuevo}>
            <Plus />
            Nueva iniciativa
          </Button>
        </div>
      </div>

      {/* ── Mapa de semáforos ─────────────────────────────────────────── */}
      <section className="surface-section overflow-hidden">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-bold">Mapa integrado de semáforos</h2>
          <p className="text-xs text-muted-foreground">
            Entregables reales por fase y fecha de salida al mercado. Toca una fila para ver el
            detalle.
          </p>
        </header>

        {filtrados.length === 0 ? (
          <EmptyState
            icon={LayoutGrid}
            title="Ninguna iniciativa coincide"
            description="Ajusta los filtros de búsqueda, o agrega la primera iniciativa al pipeline."
            action={
              <Button size="sm" onClick={abrirNuevo}>
                <Plus />
                Nueva iniciativa
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-56">Producto / Célula</TableHead>
                  <TableHead className="w-40">SLA de lanzamiento</TableHead>
                  {FASES.map((fase) => (
                    <TableHead key={fase} className="w-28 text-center">
                      <span style={{ color: FASE_COLOR[fase] }}>
                        {FASE_CORTA[fase]}: {FASE_LABEL[fase]}
                      </span>
                    </TableHead>
                  ))}
                  <TableHead className="w-28 text-center">Cumplimiento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((fila, indice) => {
                  const porcentaje = pct(fila.avance.hechos, fila.avance.totales)
                  const colorPct =
                    porcentaje >= 75
                      ? "var(--success)"
                      : porcentaje >= 40
                        ? "var(--primary)"
                        : "var(--danger)"
                  return (
                    <TableRow
                      key={fila.producto.id}
                      className="row-enter cursor-pointer"
                      style={{ "--i": indice } as CSSProperties}
                      onClick={() => setProductoAbierto(fila.producto)}
                    >
                      <TableCell>
                        <p className="text-xs font-bold">{fila.producto.nombre}</p>
                        <span className="text-eyebrow mt-1 inline-block rounded-md bg-accent px-1.5 py-0.5 text-accent-foreground">
                          {CELULA_LABEL[fila.producto.celula]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs font-semibold tabular-nums">
                          {fila.producto.fecha_limite}
                        </p>
                        <span
                          className={`text-eyebrow mt-1 inline-block rounded-full px-2 py-0.5 ${fila.estado.badge}`}
                        >
                          {fila.estado.label}
                        </span>
                      </TableCell>

                      {/* Los puntos son la lectura rápida —cuántos hitos hay y
                          cuántos van— y la fracción es la exacta. Solo con la
                          fracción, "1/2" y "2/4" se leen igual de lejos. */}
                      {FASES.map((fase) => {
                        const f = fila.avance.porFase[fase]
                        return (
                          <TableCell key={fase} className="text-center">
                            <div className="flex flex-wrap justify-center gap-0.5">
                              {Array.from({ length: f.totales }, (_, i) => (
                                <span
                                  key={i}
                                  aria-hidden
                                  className="size-2 rounded-full"
                                  style={{
                                    background:
                                      i < f.hechos ? FASE_COLOR[fase] : "var(--border)",
                                  }}
                                />
                              ))}
                            </div>
                            <span
                              className="text-eyebrow mt-1 block tabular-nums"
                              style={{
                                color:
                                  f.totales > 0 && f.hechos === f.totales
                                    ? "var(--success)"
                                    : f.hechos > 0
                                      ? FASE_COLOR[fase]
                                      : "var(--muted-foreground)",
                              }}
                            >
                              {f.hechos}/{f.totales}
                            </span>
                          </TableCell>
                        )
                      })}

                      <TableCell className="text-center">
                        <p
                          className="text-display text-base font-black tabular-nums"
                          style={{ color: colorPct }}
                        >
                          {porcentaje}%
                        </p>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${porcentaje}%`, background: colorPct }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {productoAbierto && (
        <ProductoPanel
          producto={
            // Se relee de la lista para que el panel refleje una edición hecha
            // desde el diálogo sin tener que cerrarlo y volverlo a abrir.
            (productos ?? []).find((p) => p.id === productoAbierto.id) ?? null
          }
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
