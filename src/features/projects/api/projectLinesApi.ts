import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/types/database.types"

export type ProjectLine = Database["public"]["Tables"]["project_lines"]["Row"]

// Líneas de proyecto: filas adicionales de un mismo proyecto en la sábana,
// para dividirlo en frentes de trabajo con horas independientes (ver
// supabase/migrations/*_lineas_de_proyecto.sql). Son del proyecto, no del
// mes — se traen todas de una vez, como los proyectos mismos.
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

// Borrar una línea se lleva sus horas (allocations.line_id on delete
// cascade): es una fila más de la sábana, no un proyecto, así que no hace
// falta la misma confirmación pesada que borrar un proyecto — el llamador
// decide si pide confirmación antes.
export async function deleteProjectLine(id: string): Promise<void> {
  const { error } = await supabase.from("project_lines").delete().eq("id", id)
  if (error) throw error
}
