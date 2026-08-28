import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/types/database.types"

export type ProjectLine = Database["public"]["Tables"]["project_lines"]["Row"]

// Subproyectos: todo proyecto tiene al menos uno (se crea automático con su
// mismo nombre al crear el proyecto, ver *_subproyecto_obligatorio.sql). Son
// filas independientes en la sábana con sus propias horas por persona, y el
// nombre de tabla/columna (project_lines / line_id) se mantiene desde cuando
// se llamaban "líneas" para no repetir la migración de las FKs. Son del
// proyecto, no del mes — se traen todas de una vez, como los proyectos mismos.
export async function listProjectLines(): Promise<ProjectLine[]> {
  const { data, error } = await supabase
    .from("project_lines")
    .select("*")
    .order("position", { ascending: true })
  if (error) throw error
  return data
}

export async function createProjectLine(projectId: string, name: string): Promise<ProjectLine> {
  // La posición nueva va al final: se cuenta cuántas líneas tiene ya el
  // proyecto en vez de pedirle el número a quien llama, para que crear una
  // línea sea una sola decisión (el nombre) y no dos.
  const { count, error: countError } = await supabase
    .from("project_lines")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
  if (countError) throw countError

  const { data, error } = await supabase
    .from("project_lines")
    .insert({ project_id: projectId, name, position: count ?? 0 })
    .select("*")
    .single()
  if (error) throw error
  return data
}

export async function renameProjectLine(id: string, name: string): Promise<ProjectLine> {
  const { data, error } = await supabase
    .from("project_lines")
    .update({ name })
    .eq("id", id)
    .select("*")
    .single()
  if (error) throw error
  return data
}

// Borrar un subproyecto se lleva sus horas (allocations.line_id on delete
// cascade). No se puede borrar el último subproyecto de un proyecto — todo
// proyecto necesita al menos uno — y un trigger en la base (ver
// *_subproyecto_obligatorio.sql) lo rechaza con un mensaje claro.
export async function deleteProjectLine(id: string): Promise<void> {
  const { error } = await supabase.from("project_lines").delete().eq("id", id)
  if (error) throw error
}
