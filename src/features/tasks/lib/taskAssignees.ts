import type { TaskAssignee } from "@/features/tasks/api/tasksApi"
import type { Person } from "@/features/people/api/peopleApi"

// Agrupa task_assignees por tarea y resuelve los nombres contra el roster,
// para que las vistas de tablero/backlog no tengan que repetir el join.
export function buildAssigneesByTask(
  taskAssignees: TaskAssignee[],
  people: Person[]
): Map<string, string[]> {
  const nameById = new Map(people.map((p) => [p.id, p.name]))
  const map = new Map<string, string[]>()
  for (const a of taskAssignees) {
    const name = nameById.get(a.person_id)
    if (!name) continue
    const list = map.get(a.task_id) ?? []
    list.push(name)
    map.set(a.task_id, list)
  }
  return map
}

// Ids de las personas asignadas a una tarea, para el filtro "Persona" del
// tablero (una tarea cuenta si CUALQUIERA de sus asignados calza).
export function buildAssigneeIdsByTask(taskAssignees: TaskAssignee[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const a of taskAssignees) {
    const list = map.get(a.task_id) ?? []
    list.push(a.person_id)
    map.set(a.task_id, list)
  }
  return map
}
