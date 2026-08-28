import type { Task, TaskAssignee } from "@/features/tasks/api/tasksApi"

/**
 * Planeado contra ejecutado, agregado por analista o por proyecto.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA COMPARACIÓN HONESTA
 * `completed_hours` solo existe cuando alguien entregó la tarea a revisión —
 * es el dato que se le pide en ese momento. Así que comparar "lo estimado de
 * TODAS las tarjetas" contra "lo real de las entregadas" da siempre una
 * desviación falsamente negativa: a mitad de mes parecería que todo el mundo
 * se está quedando corto, cuando lo que pasa es que aún no ha entregado.
 *
 * Por eso `planeado` suma el estimado SOLO de las tarjetas que ya tienen
 * horas reales. Es decir: de las mismas tarjetas, qué se creía que iban a
 * costar y qué costaron. Lo que falta por entregar se cuenta aparte, en
 * `pendiente`, que es otra pregunta ("cuánto trabajo queda") y no se mezcla.
 *
 * `completed_hours is not null` y no un estado concreto: las horas se
 * reportan al ENTREGAR A REVISIÓN, así que el dato ya existe mientras el
 * gestor revisa. Filtrar por `status = 'completada'` dejaría fuera todo lo
 * que está en revisión, que ya tiene su hora real medida.
 * ─────────────────────────────────────────────────────────────────────────
 */
export interface FilaEjecucion {
  id: string
  nombre: string
  /** Color del proyecto; las personas no tienen. */
  color?: string
  /** Horas repartidas en la sábana. Puede no existir para esta fila. */
  repartidas: number | null
  /** Estimado de las tarjetas YA entregadas. */
  planeado: number
  /** Horas reales reportadas al entregar. */
  real: number
  /** Estimado de lo que todavía no se entrega. */
  pendiente: number
  entregadas: number
  totalTareas: number
}

/** real − planeado. Positivo = tomó más de lo previsto. */
export const desviacion = (fila: FilaEjecucion) => fila.real - fila.planeado

/** Desviación en porcentaje sobre lo planeado. `null` si no hay base. */
export const desviacionPct = (fila: FilaEjecucion) =>
  fila.planeado > 0 ? ((fila.real - fila.planeado) / fila.planeado) * 100 : null

const filaVacia = (id: string, nombre: string, color?: string): FilaEjecucion => ({
  id,
  nombre,
  color,
  repartidas: null,
  planeado: 0,
  real: 0,
  pendiente: 0,
  entregadas: 0,
  totalTareas: 0,
})

/**
 * Las tarjetas que entran al informe: las de trabajo de proyecto.
 *
 * Los tickets de la Mesa de ayuda quedan fuera. No se planean en la sábana
 * —entran solos desde un correo— así que aparecerían siempre como horas
 * reales sin nada planeado enfrente, ensuciando la desviación de quien
 * atiende soporte.
 */
export const esTareaDeProyecto = (task: Task) => task.ticket_number === null

function acumular(fila: FilaEjecucion, task: Task, peso: number) {
  const estimado = (task.estimated_hours ?? 0) * peso
  fila.totalTareas += peso

  if (task.completed_hours !== null) {
    fila.entregadas += peso
    fila.planeado += estimado
    fila.real += task.completed_hours * peso
  } else {
    fila.pendiente += estimado
  }
}

/**
 * Agregado por persona.
 *
 * Una tarjeta con varios responsables reparte sus horas entre ellos por
 * partes iguales. Atribuirla entera a cada uno haría que la suma de las
 * filas no diera el total del equipo, y un informe cuyas partes no suman el
 * todo no se puede usar para nada.
 */
export function ejecucionPorPersona(
  tasks: Task[],
  assignees: TaskAssignee[],
  nombrePorPersona: Map<string, string>,
  repartidasPorPersona?: Map<string, number>
): FilaEjecucion[] {
  const responsablesPorTarea = new Map<string, string[]>()
  for (const a of assignees) {
    const lista = responsablesPorTarea.get(a.task_id) ?? []
    lista.push(a.person_id)
    responsablesPorTarea.set(a.task_id, lista)
  }

  const filas = new Map<string, FilaEjecucion>()

  for (const task of tasks) {
    if (!esTareaDeProyecto(task)) continue
    const responsables = responsablesPorTarea.get(task.id) ?? []
    if (responsables.length === 0) continue

    const peso = 1 / responsables.length
    for (const personId of responsables) {
      const fila =
        filas.get(personId) ??
        filaVacia(personId, nombrePorPersona.get(personId) ?? "Sin nombre")
      acumular(fila, task, peso)
      filas.set(personId, fila)
    }
  }

  // Las horas repartidas se suman al final: existen aunque la persona no
  // tenga ni una tarjeta, y ese caso —horas asignadas sin desglosar en
  // actividades— es justo el que hay que poder ver.
  if (repartidasPorPersona) {
    for (const [personId, horas] of repartidasPorPersona) {
      const fila =
        filas.get(personId) ??
        filaVacia(personId, nombrePorPersona.get(personId) ?? "Sin nombre")
      fila.repartidas = horas
      filas.set(personId, fila)
    }
  }

  return [...filas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
}

/** Agregado por proyecto. Sin reparto: una tarjeta es de un solo proyecto. */
export function ejecucionPorProyecto(
  tasks: Task[],
  nombrePorProyecto: Map<string, { nombre: string; color: string }>,
  repartidasPorProyecto?: Map<string, number>
): FilaEjecucion[] {
  const filas = new Map<string, FilaEjecucion>()

  for (const task of tasks) {
    if (!esTareaDeProyecto(task)) continue
    const meta = nombrePorProyecto.get(task.project_id)
    const fila =
      filas.get(task.project_id) ??
      filaVacia(task.project_id, meta?.nombre ?? "Sin proyecto", meta?.color)
    acumular(fila, task, 1)
    filas.set(task.project_id, fila)
  }

  if (repartidasPorProyecto) {
    for (const [projectId, horas] of repartidasPorProyecto) {
      const meta = nombrePorProyecto.get(projectId)
      const fila =
        filas.get(projectId) ??
        filaVacia(projectId, meta?.nombre ?? "Sin proyecto", meta?.color)
      fila.repartidas = horas
      filas.set(projectId, fila)
    }
  }

  return [...filas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
}

/** Totales de un conjunto de filas, para la cabecera del panel. */
export function totalizar(filas: FilaEjecucion[]) {
  return filas.reduce(
    (acc, f) => ({
      repartidas: acc.repartidas + (f.repartidas ?? 0),
      planeado: acc.planeado + f.planeado,
      real: acc.real + f.real,
      pendiente: acc.pendiente + f.pendiente,
      entregadas: acc.entregadas + f.entregadas,
      totalTareas: acc.totalTareas + f.totalTareas,
    }),
    { repartidas: 0, planeado: 0, real: 0, pendiente: 0, entregadas: 0, totalTareas: 0 }
  )
}
