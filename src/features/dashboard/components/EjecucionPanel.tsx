import { useMemo, useState, type CSSProperties } from "react"
import { Scale } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import EmptyState from "@/components/shared/EmptyState"
import { STATUS_LABELS } from "@/features/tasks/lib/taskLabels"
import {
  desviacion,
  desviacionPct,
  ejecucionPorPersona,
  ejecucionPorProyecto,
  esTareaDeProyecto,
  totalizar,
  type FilaEjecucion,
} from "@/features/dashboard/lib/ejecucion"
import type { Task, TaskAssignee } from "@/features/tasks/api/tasksApi"
import type { Project } from "@/features/projects/api/projectsApi"
import type { PersonMonthTotal, ProjectMonthTotal } from "@/features/dashboard/api/dashboardApi"

const TODOS = "TODOS"
type Vista = "persona" | "proyecto"

const horas = (valor: number) =>
  `${valor % 1 === 0 ? valor : valor.toFixed(1)} h`

// Color de la desviación. El cero exacto no es "bueno", es sospechoso —
// suele significar que copiaron el estimado en el campo de horas reales—,
// pero no hay forma de distinguirlo de una estimación perfecta, así que se
// deja en neutro y no se premia con verde.
function tonoDesviacion(fila: FilaEjecucion) {
  if (fila.entregadas === 0) return "text-muted-foreground"
  const pct = desviacionPct(fila)
  if (pct === null) return "text-muted-foreground"
  if (Math.abs(pct) <= 10) return "text-success"
  if (Math.abs(pct) <= 25) return "text-warning"
  return "text-danger"
}

const signo = (valor: number) => (valor > 0 ? "+" : "")

interface EjecucionPanelProps {
  tasks: Task[]
  assignees: TaskAssignee[]
  projects: Project[]
  personTotals: PersonMonthTotal[]
  projectTotals: ProjectMonthTotal[]
}

// Planeado contra ejecutado del mes: el cierre del ciclo que arranca en la
// sábana y termina cuando el analista reporta sus horas al entregar.
//
// POR QUÉ NO APLICA LA EXCLUSIÓN DE PLANEACIÓN
// El resto del Dashboard esconde a Gestores, Coordinador y Administrador
// porque mide CAPACIDAD, y ellos no entran al reparto de horas. Este panel
// mide TRABAJO HECHO: si alguno de ellos entregó una tarjeta, esas horas son
// reales y tienen que contar. Esconderlas dejaría el total del panel sin
// cuadrar con la suma de las tarjetas del tablero.
export default function EjecucionPanel({
  tasks,
  assignees,
  projects,
  personTotals,
  projectTotals,
}: EjecucionPanelProps) {
  const [vista, setVista] = useState<Vista>("persona")
  const [seleccion, setSeleccion] = useState<string>(TODOS)

  const nombrePorPersona = useMemo(
    () => new Map(personTotals.map((p) => [p.person_id, p.name])),
    [personTotals]
  )
  const metaPorProyecto = useMemo(
    () => new Map(projects.map((p) => [p.id, { nombre: p.name, color: p.color }])),
    [projects]
  )
  const repartidasPorPersona = useMemo(
    () => new Map(personTotals.map((p) => [p.person_id, p.allocated_hours])),
    [personTotals]
  )
  const repartidasPorProyecto = useMemo(
    () => new Map(projectTotals.map((p) => [p.project_id, p.allocated_hours])),
    [projectTotals]
  )

  const filas = useMemo(
    () =>
      vista === "persona"
        ? ejecucionPorPersona(tasks, assignees, nombrePorPersona, repartidasPorPersona)
        : ejecucionPorProyecto(tasks, metaPorProyecto, repartidasPorProyecto),
    [
      vista,
      tasks,
      assignees,
      nombrePorPersona,
      metaPorProyecto,
      repartidasPorPersona,
      repartidasPorProyecto,
    ]
  )

  const visibles = useMemo(
    () => (seleccion === TODOS ? filas : filas.filter((f) => f.id === seleccion)),
    [filas, seleccion]
  )
  const totales = useMemo(() => totalizar(visibles), [visibles])

  // Detalle tarjeta por tarjeta: solo cuando hay UNO seleccionado. Es el
  // "¿cómo va este en concreto?" — con todos a la vez sería una lista de
  // cientos de filas que no responde ninguna pregunta.
  const detalle = useMemo(() => {
    if (seleccion === TODOS) return []
    const propias = tasks.filter((t) => {
      if (!esTareaDeProyecto(t)) return false
      if (vista === "proyecto") return t.project_id === seleccion
      return assignees.some((a) => a.task_id === t.id && a.person_id === seleccion)
    })
    // Entregadas primero: son las que ya tienen algo que comparar.
    return propias.sort((a, b) => {
      const ea = a.completed_hours !== null ? 0 : 1
      const eb = b.completed_hours !== null ? 0 : 1
      return ea - eb || a.title.localeCompare(b.title)
    })
  }, [seleccion, vista, tasks, assignees])

  const cambiarVista = (valor: string) => {
    setVista(valor as Vista)
    // La selección no sobrevive al cambio de eje: un id de persona no existe
    // en la lista de proyectos y el filtro quedaría mostrando vacío.
    setSeleccion(TODOS)
  }

  const desvTotal = totales.real - totales.planeado

  return (
    <Card className="card-lift">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="size-4" /> Planeado vs. ejecutado
        </CardTitle>
        <CardDescription>
          Horas estimadas contra horas reales reportadas al entregar. Se comparan solo las
          tarjetas ya entregadas; lo que falta se cuenta aparte como pendiente.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Filtros */}
        <div className="filter-bar">
          <Tabs value={vista} onValueChange={cambiarVista}>
            <TabsList>
              <TabsTrigger value="persona">Por analista</TabsTrigger>
              <TabsTrigger value="proyecto">Por proyecto</TabsTrigger>
            </TabsList>
          </Tabs>

          <Select value={seleccion} onValueChange={setSeleccion}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>
                {vista === "persona" ? "Todos los analistas" : "Todos los proyectos"}
              </SelectItem>
              {filas.map((fila) => (
                <SelectItem key={fila.id} value={fila.id}>
                  {fila.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1 px-1">
            <span className="text-xs">
              <span className="text-muted-foreground">Planeado </span>
              <span className="font-bold tabular-nums">{horas(totales.planeado)}</span>
            </span>
            <span className="text-xs">
              <span className="text-muted-foreground">Real </span>
              <span className="font-bold tabular-nums">{horas(totales.real)}</span>
            </span>
            <span className="text-xs">
              <span className="text-muted-foreground">Desviación </span>
              <span
                className={`font-bold tabular-nums ${
                  totales.planeado === 0
                    ? "text-muted-foreground"
                    : Math.abs(desvTotal) / totales.planeado <= 0.1
                      ? "text-success"
                      : "text-danger"
                }`}
              >
                {signo(desvTotal)}
                {horas(desvTotal)}
              </span>
            </span>
          </div>
        </div>

        {/* Filas agregadas */}
        {visibles.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="Todavía no hay nada que comparar"
            description="Cuando el equipo empiece a entregar tarjetas a revisión, aquí aparecen sus horas reales contra lo estimado."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {visibles.map((fila, indice) => {
              const desv = desviacion(fila)
              const pct = desviacionPct(fila)
              // Las dos barras comparten escala: el mayor de los dos marca el
              // 100%. Con escalas independientes, 4h y 40h se verían igual de
              // largas y la comparación —que es todo el punto— se perdería.
              const tope = Math.max(fila.planeado, fila.real, 1)

              return (
                <li
                  key={fila.id}
                  className="stagger-item rounded-xl border border-border p-3"
                  style={{ "--i": indice } as CSSProperties}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {fila.color && (
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: fila.color }}
                      />
                    )}
                    <span className="text-sm font-semibold">{fila.nombre}</span>
                    <Badge variant="ghost" className="bg-muted text-muted-foreground">
                      {fila.entregadas} de {fila.totalTareas} entregadas
                    </Badge>
                    {fila.repartidas !== null && (
                      <span className="text-xs text-muted-foreground">
                        {horas(fila.repartidas)} repartidas en la sábana
                      </span>
                    )}
                    <span className={`ml-auto text-sm font-bold tabular-nums ${tonoDesviacion(fila)}`}>
                      {fila.entregadas === 0
                        ? "Sin entregas"
                        : `${signo(desv)}${horas(desv)}${
                            pct !== null ? ` · ${signo(pct)}${pct.toFixed(0)}%` : ""
                          }`}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-col gap-1">
                    {[
                      { label: "Planeado", valor: fila.planeado, color: "var(--muted-foreground)" },
                      { label: "Real", valor: fila.real, color: "var(--primary)" },
                    ].map((barra) => (
                      <div key={barra.label} className="flex items-center gap-2">
                        <span className="text-eyebrow w-16 shrink-0 text-muted-foreground">
                          {barra.label}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="animate-bar h-full rounded-full"
                            style={{
                              width: `${(barra.valor / tope) * 100}%`,
                              background: barra.color,
                            }}
                          />
                        </div>
                        <span className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums">
                          {horas(barra.valor)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {fila.pendiente > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Quedan {horas(fila.pendiente)} estimadas sin entregar.
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {/* Detalle tarjeta por tarjeta del seleccionado */}
        {seleccion !== TODOS && detalle.length > 0 && (
          <div className="rounded-xl border border-border">
            <p className="text-eyebrow border-b border-border px-3 py-2 text-muted-foreground">
              Tarjeta por tarjeta
            </p>
            <ul className="divide-y divide-border/60">
              {detalle.map((task) => {
                const desv =
                  task.completed_hours !== null
                    ? task.completed_hours - (task.estimated_hours ?? 0)
                    : null
                return (
                  <li key={task.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-xs" title={task.title}>
                      {task.title}
                    </span>
                    <Badge variant="ghost" className="bg-muted text-muted-foreground">
                      {STATUS_LABELS[task.status]}
                    </Badge>
                    <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">
                      {task.estimated_hours !== null ? horas(task.estimated_hours) : "—"}
                    </span>
                    <span className="w-20 text-right text-xs font-semibold tabular-nums">
                      {task.completed_hours !== null ? horas(task.completed_hours) : "—"}
                    </span>
                    <span
                      className={`w-20 text-right text-xs font-bold tabular-nums ${
                        desv === null
                          ? "text-muted-foreground"
                          : desv > 0
                            ? "text-danger"
                            : "text-success"
                      }`}
                    >
                      {desv === null ? "pendiente" : `${signo(desv)}${horas(desv)}`}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
