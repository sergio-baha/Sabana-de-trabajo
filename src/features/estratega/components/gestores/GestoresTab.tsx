import { useMemo, useState, type CSSProperties } from "react"
import { ClipboardList, Pencil, Plus, Search, Trash2, Wallet } from "lucide-react"
import EmptyState from "@/components/shared/EmptyState"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import { Badge } from "@/components/ui/badge"
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
import { useProfiles } from "@/hooks/useProfiles"
import {
  useDeleteEntregable,
  useDeleteFinanza,
  useEntregables,
  useFinanzas,
} from "@/features/estratega/hooks/useGobernanzaQueries"
import {
  ESTADOS,
  ESTADO_BADGE,
  ESTADO_LABEL,
  SIN_ESTADO_LABEL,
  colorDeGestor,
  formatCOP,
  inicialesDe,
  periodoKey,
  periodoLabel,
  porcentajeEjecucion,
  semaforoEjecucion,
  type EntregaEstado,
  type GestorOption,
} from "@/features/estratega/lib/gobernanza"
import DonutEstados, {
  type ConteoEstado,
} from "@/features/estratega/components/gestores/DonutEstados"
import BarrasEjecucion, {
  type TotalGestor,
} from "@/features/estratega/components/gestores/BarrasEjecucion"
import FinanzaFormDialog from "@/features/estratega/components/gestores/FinanzaFormDialog"
import EntregableFormDialog from "@/features/estratega/components/gestores/EntregableFormDialog"
import type { Entregable, Finanza } from "@/features/estratega/api/gobernanzaApi"

const TODOS = "TODOS"

// Seguimiento de gestores: cuánto de lo presupuestado lleva ejecutado cada
// quien, y qué pasó con los compromisos del período.
//
// Los tres filtros de arriba mandan sobre TODA la pestaña —KPIs, gráficas,
// tarjetas y tabla— para que lo que se ve arriba siempre explique lo que se
// ve abajo. En el tablero original la búsqueda solo afectaba a la tabla y a
// la dona, y las cifras de arriba se quedaban en el consolidado: dos
// verdades en la misma pantalla.
export default function GestoresTab() {
  const { data: finanzas, isLoading: cargandoFinanzas } = useFinanzas()
  const { data: entregables, isLoading: cargandoEntregables } = useEntregables()
  const { data: perfiles } = useProfiles()

  const [periodo, setPeriodo] = useState<string>(TODOS)
  const [gestor, setGestor] = useState<string>(TODOS)
  const [busqueda, setBusqueda] = useState("")

  const [finanzaEnEdicion, setFinanzaEnEdicion] = useState<Finanza | null>(null)
  const [finanzaAbierta, setFinanzaAbierta] = useState(false)
  const [entregableEnEdicion, setEntregableEnEdicion] = useState<Entregable | null>(null)
  const [entregableAbierto, setEntregableAbierto] = useState(false)
  const [aEliminar, setAEliminar] = useState<
    { tipo: "finanza" | "entregable"; id: string } | null
  >(null)

  const borrarFinanza = useDeleteFinanza()
  const borrarEntregable = useDeleteEntregable()

  // ── Períodos y gestores disponibles ───────────────────────────────────
  // Salen de los datos, no de una lista fija. El dashboard original tenía los
  // cuatro gestores escritos a mano en el código, y por eso Claudia Gacharná
  // aparecía en el filtro pero nunca en las tarjetas ni en las barras.
  const periodos = useMemo(() => {
    const vistos = new Map<string, { anio: number; mes: number }>()
    for (const f of finanzas ?? []) vistos.set(periodoKey(f.anio, f.mes), { anio: f.anio, mes: f.mes })
    for (const e of entregables ?? []) vistos.set(periodoKey(e.anio, e.mes), { anio: e.anio, mes: e.mes })
    return [...vistos.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, valor]) => ({ key, ...valor }))
  }, [finanzas, entregables])

  const gestores = useMemo<GestorOption[]>(() => {
    const vistos = new Map<string, GestorOption>()
    // Primero las cuentas activas: son los gestores "de verdad", los que
    // pueden recibir un período nuevo.
    for (const p of perfiles ?? []) {
      if (p.is_active) vistos.set(p.full_name, { nombre: p.full_name, profileId: p.id })
    }
    // Luego los nombres que ya están en el dato y no casaron con ninguna
    // cuenta: siguen siendo elegibles, para poder corregir su histórico.
    for (const f of finanzas ?? []) {
      if (!vistos.has(f.colaborador)) {
        vistos.set(f.colaborador, { nombre: f.colaborador, profileId: f.profile_id })
      }
    }
    for (const e of entregables ?? []) {
      if (!vistos.has(e.colaborador)) {
        vistos.set(e.colaborador, { nombre: e.colaborador, profileId: e.profile_id })
      }
    }
    return [...vistos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [perfiles, finanzas, entregables])

  /** Los gestores que efectivamente tienen dato: los que se pintan. */
  const gestoresConDato = useMemo(() => {
    const vistos = new Set<string>()
    for (const f of finanzas ?? []) vistos.add(f.colaborador)
    return [...vistos].sort((a, b) => a.localeCompare(b))
  }, [finanzas])

  // ── Datos filtrados ───────────────────────────────────────────────────
  const finanzasFiltradas = useMemo(
    () =>
      (finanzas ?? []).filter(
        (f) =>
          (periodo === TODOS || periodoKey(f.anio, f.mes) === periodo) &&
          (gestor === TODOS || f.colaborador === gestor)
      ),
    [finanzas, periodo, gestor]
  )

  const entregablesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return (entregables ?? []).filter((e) => {
      if (periodo !== TODOS && periodoKey(e.anio, e.mes) !== periodo) return false
      if (gestor !== TODOS && e.colaborador !== gestor) return false
      if (!texto) return true
      return (
        e.descripcion.toLowerCase().includes(texto) || e.colaborador.toLowerCase().includes(texto)
      )
    })
  }, [entregables, periodo, gestor, busqueda])

  // ── Agregados ─────────────────────────────────────────────────────────
  const totalPresupuestado = finanzasFiltradas.reduce((s, f) => s + Number(f.presupuestado), 0)
  const totalEjecutado = finanzasFiltradas.reduce((s, f) => s + Number(f.ejecutado), 0)
  const porcentaje = porcentajeEjecucion(totalPresupuestado, totalEjecutado)
  const semaforo = semaforoEjecucion(porcentaje)

  const conteosEstado = useMemo<ConteoEstado[]>(() => {
    const conteo = new Map<EntregaEstado | null, number>()
    for (const e of entregablesFiltrados) conteo.set(e.estado, (conteo.get(e.estado) ?? 0) + 1)
    // Orden fijo por estado, no por frecuencia: si la dona reordena sus
    // colores cada vez que cambia el filtro, deja de poder compararse.
    const orden: (EntregaEstado | null)[] = [...ESTADOS, null]
    return orden
      .filter((estado) => conteo.has(estado))
      .map((estado) => ({ estado, total: conteo.get(estado) as number }))
  }, [entregablesFiltrados])

  const totalesPorGestor = useMemo<TotalGestor[]>(() => {
    const visibles = gestor === TODOS ? gestoresConDato : [gestor]
    return visibles.map((nombre) => {
      const suyas = finanzasFiltradas.filter((f) => f.colaborador === nombre)
      return {
        colaborador: nombre,
        presupuestado: suyas.reduce((s, f) => s + Number(f.presupuestado), 0),
        ejecutado: suyas.reduce((s, f) => s + Number(f.ejecutado), 0),
      }
    })
  }, [finanzasFiltradas, gestoresConDato, gestor])

  // Período sugerido al abrir un formulario: el que esté filtrado, o el más
  // reciente que exista. Ahorra dos selects en el caso normal, que es
  // registrar el mes que uno está mirando.
  const ultimo = periodos[periodos.length - 1]
  const sugerido =
    periodo === TODOS
      ? { anio: ultimo?.anio ?? new Date().getFullYear(), mes: ultimo?.mes ?? new Date().getMonth() + 1 }
      : periodos.find((p) => p.key === periodo) ?? { anio: new Date().getFullYear(), mes: 1 }

  const cargando = cargandoFinanzas || cargandoEntregables

  const abrirFinanza = (finanza: Finanza | null) => {
    setFinanzaEnEdicion(finanza)
    setFinanzaAbierta(true)
  }

  const abrirEntregable = (entregable: Entregable | null) => {
    setEntregableEnEdicion(entregable)
    setEntregableAbierto(true)
  }

  const confirmarBorrado = async () => {
    if (!aEliminar) return
    if (aEliminar.tipo === "finanza") await borrarFinanza.mutateAsync(aEliminar.id)
    else await borrarEntregable.mutateAsync(aEliminar.id)
    setAEliminar(null)
  }

  if (cargando) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Filtros ───────────────────────────────────────────────────── */}
      <div className="filter-bar">
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Consolidado acumulado</SelectItem>
            {periodos.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {periodoLabel(p.anio, p.mes)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={gestor} onValueChange={setGestor}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los gestores</SelectItem>
            {gestoresConDato.map((nombre) => (
              <SelectItem key={nombre} value={nombre}>
                {nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative min-w-52 flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar iniciativa: Ecosistema, NOVA, XpertPro…"
            className="pl-8"
            aria-label="Buscar entregable"
          />
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => abrirFinanza(null)}>
            <Wallet />
            Registrar ejecución
          </Button>
          <Button size="sm" onClick={() => abrirEntregable(null)}>
            <Plus />
            Nuevo entregable
          </Button>
        </div>
      </div>

      {/* ── Indicadores financieros ───────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Presupuestado", valor: formatCOP(totalPresupuestado), pie: "Valor base asignado" },
          { label: "Ejecutado", valor: formatCOP(totalEjecutado), pie: "Inversión real registrada" },
        ].map((kpi, indice) => (
          <div
            key={kpi.label}
            className="surface-section stagger-item card-lift p-5"
            style={{ "--i": indice } as CSSProperties}
          >
            <span className="text-eyebrow text-muted-foreground">{kpi.label}</span>
            <p className="text-display mt-1 text-2xl font-black tabular-nums">{kpi.valor}</p>
            <p className="mt-1 text-xs text-muted-foreground">COP · {kpi.pie}</p>
          </div>
        ))}

        <div className="surface-section stagger-item card-lift p-5" style={{ "--i": 2 } as CSSProperties}>
          <span className="text-eyebrow text-muted-foreground">% Ejecución presupuestal</span>
          <p className="text-display mt-1 text-2xl font-black tabular-nums">
            {porcentaje.toFixed(2)}%
          </p>
          {/* La barra se corta en 100% pero el número no: la sobre-ejecución
              se lee en la cifra y en el color, no estirando la barra fuera
              de su riel. */}
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="animate-bar h-full rounded-full"
              style={{ width: `${Math.min(porcentaje, 100)}%`, background: semaforo.color }}
            />
          </div>
          <span className={`text-eyebrow mt-2 inline-block rounded-full px-2 py-0.5 ${semaforo.badge}`}>
            {semaforo.label}
          </span>
        </div>
      </div>

      {/* ── Gráficas ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <section className="surface-section p-5">
          <h2 className="text-sm font-bold">Distribución por estado</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Entregables del período y gestor filtrados.
          </p>
          <DonutEstados conteos={conteosEstado} />
        </section>

        <section className="surface-section p-5">
          <h2 className="text-sm font-bold">Ejecución financiera por gestor</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Presupuestado contra ejecutado, en pesos.
          </p>
          <BarrasEjecucion totales={totalesPorGestor} />
        </section>
      </div>

      {/* ── Tarjetas por gestor ───────────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {totalesPorGestor.map((total, indice) => {
          const pct = porcentajeEjecucion(total.presupuestado, total.ejecutado)
          const sem = semaforoEjecucion(pct)
          const tieneDato = total.presupuestado > 0 || total.ejecutado > 0
          const filaDelMes =
            periodo !== TODOS
              ? finanzasFiltradas.find((f) => f.colaborador === total.colaborador)
              : undefined

          return (
            <article
              key={total.colaborador}
              className="surface-section stagger-item card-lift flex flex-col gap-3 p-5"
              style={{ "--i": indice } as CSSProperties}
            >
              <header className="flex items-center gap-3">
                <div
                  aria-hidden
                  className="grid size-10 shrink-0 place-content-center rounded-full text-sm font-bold text-white"
                  style={{ background: colorDeGestor(total.colaborador) }}
                >
                  {inicialesDe(total.colaborador)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{total.colaborador}</p>
                  <p className="text-xs text-muted-foreground">
                    {periodo === TODOS ? "Consolidado" : periodoLabel(sugerido.anio, sugerido.mes)}
                  </p>
                </div>
                {/* Corregir la cifra del mes solo tiene sentido con un mes
                    seleccionado: en el consolidado no hay una fila que editar. */}
                {filaDelMes && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="ml-auto"
                    aria-label={`Corregir la ejecución de ${total.colaborador}`}
                    onClick={() => abrirFinanza(filaDelMes)}
                  >
                    <Pencil />
                  </Button>
                )}
              </header>

              <dl className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Presupuestado</dt>
                  <dd className="font-bold tabular-nums">{formatCOP(total.presupuestado)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Ejecutado</dt>
                  <dd className="font-bold tabular-nums">{formatCOP(total.ejecutado)}</dd>
                </div>
              </dl>

              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="animate-bar h-full rounded-full"
                  style={{ width: `${Math.min(pct, 100)}%`, background: sem.color }}
                />
              </div>
              <span className={`text-eyebrow w-fit rounded-full px-2 py-0.5 ${sem.badge}`}>
                {tieneDato ? `${pct.toFixed(2)}% · ${sem.label}` : "Sin datos financieros"}
              </span>
            </article>
          )
        })}
      </section>

      {/* ── Matriz de entregables ─────────────────────────────────────── */}
      <section className="surface-section overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-bold">Matriz de entregables</h2>
            <p className="text-xs text-muted-foreground">
              Los compromisos de gestión del período, con su estado.
            </p>
          </div>
          <span className="text-eyebrow text-muted-foreground">
            {entregablesFiltrados.length} registros
          </span>
        </header>

        {entregablesFiltrados.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Sin entregables para este filtro"
            description="Cambia el período o el gestor, o registra el primer compromiso del mes."
            action={
              <Button size="sm" onClick={() => abrirEntregable(null)}>
                <Plus />
                Nuevo entregable
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Período</TableHead>
                  <TableHead className="w-44">Gestor</TableHead>
                  <TableHead className="min-w-72">Entregable</TableHead>
                  <TableHead className="w-32">Estado</TableHead>
                  <TableHead className="w-24 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entregablesFiltrados.map((e, indice) => (
                  <TableRow
                    key={e.id}
                    className="row-enter"
                    style={{ "--i": indice } as CSSProperties}
                  >
                    <TableCell className="text-xs text-muted-foreground">
                      {periodoLabel(e.anio, e.mes)}
                    </TableCell>
                    <TableCell className="text-xs font-semibold">{e.colaborador}</TableCell>
                    {/* El texto completo va en el `title`: son compromisos de
                        dos renglones y recortarlos sin dar forma de leerlos
                        deja la tabla inservible. */}
                    <TableCell className="max-w-96 truncate text-xs" title={e.descripcion}>
                      {e.descripcion}
                    </TableCell>
                    <TableCell>
                      {e.estado ? (
                        <Badge variant="ghost" className={ESTADO_BADGE[e.estado]}>
                          {ESTADO_LABEL[e.estado]}
                        </Badge>
                      ) : (
                        <Badge variant="ghost" className="bg-muted text-muted-foreground">
                          {SIN_ESTADO_LABEL}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Editar entregable"
                        onClick={() => abrirEntregable(e)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Eliminar entregable"
                        onClick={() => setAEliminar({ tipo: "entregable", id: e.id })}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <FinanzaFormDialog
        open={finanzaAbierta}
        onOpenChange={setFinanzaAbierta}
        finanza={finanzaEnEdicion}
        gestores={gestores}
        anioSugerido={sugerido.anio}
        mesSugerido={sugerido.mes}
      />
      <EntregableFormDialog
        open={entregableAbierto}
        onOpenChange={setEntregableAbierto}
        entregable={entregableEnEdicion}
        gestores={gestores}
        anioSugerido={sugerido.anio}
        mesSugerido={sugerido.mes}
      />
      <ConfirmDialog
        open={aEliminar !== null}
        onOpenChange={(abierto) => !abierto && setAEliminar(null)}
        title={aEliminar?.tipo === "finanza" ? "¿Eliminar el registro?" : "¿Eliminar el entregable?"}
        description="Queda registrado en el Historial, pero desaparece del tablero y de todos sus agregados."
        onConfirm={confirmarBorrado}
      />
    </div>
  )
}
