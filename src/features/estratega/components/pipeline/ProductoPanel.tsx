import { useState, type CSSProperties } from "react"
import { AlertTriangle, CalendarDays, CheckCircle2, Flame, Info, Pencil, Plus, Trash2, Users } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import {
  useCreateItem,
  useDeleteItem,
  useDeleteProducto,
  useSetItemCompletado,
  useUpdateItemTitulo,
} from "@/features/estratega/hooks/useGobernanzaQueries"
import {
  CELULA_LABEL,
  FASES,
  FASE_COLOR,
  FASE_CORTA,
  FASE_LABEL,
  calcularUrgencia,
  diagnostico,
  periodoLabel,
  type Fase,
} from "@/features/estratega/lib/gobernanza"
import type { Producto, ProductoItem } from "@/features/estratega/api/gobernanzaApi"

const ICONO_DIAGNOSTICO = {
  vencido: AlertTriangle,
  riesgo: Flame,
  lanzado: CheckCircle2,
  en_fecha: Info,
} as const

interface ProductoPanelProps {
  producto: Producto | null
  items: ProductoItem[]
  onOpenChange: (open: boolean) => void
  onEditar: (producto: Producto) => void
}

// Detalle de una iniciativa: el diagnóstico de su estado y el checklist por
// fase, que es donde realmente se mueve el avance.
//
// No hay botón de "guardar": marcar una casilla escribe en el momento. Un
// borrador local obligaría a decidir qué pasa si alguien cierra el panel a
// medias, y el original lo resolvía con un botón que no guardaba nada — solo
// mostraba un aviso y cerraba.
export default function ProductoPanel({
  producto,
  items,
  onOpenChange,
  onEditar,
}: ProductoPanelProps) {
  const setCompletado = useSetItemCompletado()
  const crearItem = useCreateItem()
  const renombrarItem = useUpdateItemTitulo()
  const borrarItem = useDeleteItem()
  const borrarProducto = useDeleteProducto()

  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const [itemEnEdicion, setItemEnEdicion] = useState<string | null>(null)
  const [tituloEditado, setTituloEditado] = useState("")
  const [nuevoEn, setNuevoEn] = useState<Fase | null>(null)
  const [tituloNuevo, setTituloNuevo] = useState("")

  if (!producto) return null

  const propios = items.filter((i) => i.producto_id === producto.id)
  const hechos = propios.filter((i) => i.completado).length
  const totales = propios.length
  const porcentaje = totales > 0 ? Math.round((hechos / totales) * 100) : 0
  const urgencia = calcularUrgencia(producto.fecha_limite, hechos, totales)
  const dx = diagnostico(urgencia, porcentaje)
  const IconoDx = ICONO_DIAGNOSTICO[urgencia.codigo]

  const [anio, mes, dia] = producto.fecha_limite.split("-").map(Number)

  const guardarTitulo = async (item: ProductoItem) => {
    const limpio = tituloEditado.trim()
    if (limpio && limpio !== item.titulo) {
      await renombrarItem.mutateAsync({ id: item.id, titulo: limpio })
    }
    setItemEnEdicion(null)
  }

  const agregarItem = async (fase: Fase) => {
    const limpio = tituloNuevo.trim()
    if (!limpio) return
    const orden = propios.filter((i) => i.fase === fase).length + 1
    await crearItem.mutateAsync([producto.id, fase, limpio, orden])
    setTituloNuevo("")
    setNuevoEn(null)
  }

  return (
    <>
      <Sheet open onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <span className={`text-eyebrow w-fit rounded-full px-2 py-0.5 ${urgencia.badge}`}>
              {urgencia.label}
            </span>
            <SheetTitle className="text-display text-lg font-extrabold">
              {producto.nombre}
            </SheetTitle>
            <SheetDescription asChild>
              <div className="flex flex-col gap-1 text-xs">
                <span className="flex items-center gap-1.5">
                  <Users aria-hidden className="size-3.5" />
                  Célula: {CELULA_LABEL[producto.celula]}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays aria-hidden className="size-3.5" />
                  Salida planificada: {dia} de {periodoLabel(anio, mes).toLowerCase()}
                </span>
              </div>
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 px-4 pb-4">
            {/* Avance global */}
            <section className="rounded-xl border border-border bg-muted/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-eyebrow text-muted-foreground">Avance certificado</span>
                <span className="text-display text-lg font-black text-primary tabular-nums">
                  {porcentaje}%
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="animate-bar h-full rounded-full"
                  style={{ width: `${porcentaje}%`, background: "var(--grad-orange)" }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {hechos} de {totales} entregables certificados.
              </p>
            </section>

            {/* Diagnóstico: son reglas fijas sobre el estado, no una opinión
                generada — el mismo estado dice siempre lo mismo. */}
            <section
              className="flex gap-3 rounded-xl border p-4"
              style={{
                borderColor: `color-mix(in oklch, ${urgencia.color} 30%, transparent)`,
                background: `color-mix(in oklch, ${urgencia.color} 8%, transparent)`,
              }}
            >
              <div
                aria-hidden
                className="grid size-9 shrink-0 place-content-center self-start rounded-lg text-white"
                style={{ background: urgencia.color }}
              >
                <IconoDx className="size-4" />
              </div>
              <div>
                <h3 className="text-eyebrow text-muted-foreground">{dx.titulo}</h3>
                <p className="mt-1 text-xs leading-relaxed">{dx.texto}</p>
              </div>
            </section>

            {/* Checklist por fase */}
            <section className="flex flex-col gap-3">
              <h3 className="text-eyebrow text-muted-foreground">Entregables por fase</h3>

              {FASES.map((fase, indice) => {
                const deLaFase = propios.filter((i) => i.fase === fase)
                const hechosFase = deLaFase.filter((i) => i.completado).length
                return (
                  <div
                    key={fase}
                    className="stagger-item overflow-hidden rounded-xl border border-border"
                    style={{ "--i": indice } as CSSProperties}
                  >
                    <header
                      className="flex items-center justify-between border-b border-border px-3 py-2"
                      style={{ background: `color-mix(in oklch, ${FASE_COLOR[fase]} 8%, transparent)` }}
                    >
                      <span
                        className="text-eyebrow flex items-center gap-2"
                        style={{ color: FASE_COLOR[fase] }}
                      >
                        <span
                          aria-hidden
                          className="size-1.5 rounded-full"
                          style={{ background: FASE_COLOR[fase] }}
                        />
                        {FASE_CORTA[fase]} · {FASE_LABEL[fase]}
                      </span>
                      <span
                        className="text-eyebrow rounded-md px-1.5 py-0.5 tabular-nums"
                        style={{
                          color: FASE_COLOR[fase],
                          background: `color-mix(in oklch, ${FASE_COLOR[fase]} 12%, transparent)`,
                        }}
                      >
                        {hechosFase}/{deLaFase.length}
                      </span>
                    </header>

                    <ul className="flex flex-col p-2">
                      {deLaFase.map((item) => (
                        <li
                          key={item.id}
                          className="group/item flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted/60"
                        >
                          <Checkbox
                            id={item.id}
                            checked={item.completado}
                            onCheckedChange={(marcado) =>
                              setCompletado.mutate({ id: item.id, completado: marcado === true })
                            }
                          />
                          {itemEnEdicion === item.id ? (
                            <Input
                              autoFocus
                              value={tituloEditado}
                              onChange={(event) => setTituloEditado(event.target.value)}
                              onBlur={() => guardarTitulo(item)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") guardarTitulo(item)
                                if (event.key === "Escape") setItemEnEdicion(null)
                              }}
                              className="h-7 text-xs"
                            />
                          ) : (
                            <>
                              <label
                                htmlFor={item.id}
                                className={`flex-1 cursor-pointer text-xs ${
                                  item.completado
                                    ? "text-muted-foreground line-through"
                                    : "text-foreground"
                                }`}
                              >
                                {item.titulo}
                              </label>
                              {/* Las acciones aparecen al pasar el mouse: con
                                  catorce filas, dos botones fijos por fila
                                  convierten el checklist en una barra de
                                  herramientas. */}
                              <div className="flex opacity-0 transition-opacity group-hover/item:opacity-100 focus-within:opacity-100">
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label={`Renombrar ${item.titulo}`}
                                  onClick={() => {
                                    setItemEnEdicion(item.id)
                                    setTituloEditado(item.titulo)
                                  }}
                                >
                                  <Pencil />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label={`Eliminar ${item.titulo}`}
                                  onClick={() => borrarItem.mutate(item.id)}
                                >
                                  <Trash2 />
                                </Button>
                              </div>
                            </>
                          )}
                        </li>
                      ))}

                      {nuevoEn === fase ? (
                        <li className="px-1 py-1.5">
                          <Input
                            autoFocus
                            value={tituloNuevo}
                            placeholder="Nombre del entregable"
                            onChange={(event) => setTituloNuevo(event.target.value)}
                            onBlur={() => agregarItem(fase)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") agregarItem(fase)
                              if (event.key === "Escape") {
                                setTituloNuevo("")
                                setNuevoEn(null)
                              }
                            }}
                            className="h-7 text-xs"
                          />
                        </li>
                      ) : (
                        <li>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="w-full justify-start text-muted-foreground"
                            onClick={() => setNuevoEn(fase)}
                          >
                            <Plus />
                            Agregar entregable
                          </Button>
                        </li>
                      )}
                    </ul>
                  </div>
                )
              })}
            </section>

            {producto.notas && (
              <section className="rounded-xl border border-border p-4">
                <h3 className="text-eyebrow text-muted-foreground">Notas</h3>
                <p className="mt-1 text-xs leading-relaxed whitespace-pre-line">{producto.notas}</p>
              </section>
            )}
          </div>

          <SheetFooter className="flex-row justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => setConfirmarBorrado(true)}
            >
              <Trash2 />
              Remover
            </Button>
            <Button size="sm" onClick={() => onEditar(producto)}>
              <Pencil />
              Editar iniciativa
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmarBorrado}
        onOpenChange={setConfirmarBorrado}
        title="¿Remover la iniciativa del pipeline?"
        description="Se elimina junto con su checklist completo. Queda registrada en el Historial, pero deja de contar en los indicadores de lanzamiento."
        confirmLabel="Remover"
        onConfirm={async () => {
          await borrarProducto.mutateAsync(producto.id)
          setConfirmarBorrado(false)
          onOpenChange(false)
        }}
      />
    </>
  )
}
