import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/types/database.types"

export type Project = Database["public"]["Tables"]["projects"]["Row"]
export type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"]
export type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"]
export type ProjectManager = Database["public"]["Tables"]["project_managers"]["Row"]
export type ProjectMember = Database["public"]["Tables"]["project_members"]["Row"]

// Los proyectos son durables: no se filtran por mes. La dimensión mensual
// vive en `allocations`, no en el catálogo.
export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("name", { ascending: true })
  if (error) throw error
  return data
}

export async function getProject(id: string): Promise<Project> {
  const { data, error } = await supabase.from("projects").select("*").eq("id", id).single()
  if (error) throw error
  return data
}

export async function createProject(input: ProjectInsert): Promise<Project> {
  const { data, error } = await supabase.from("projects").insert(input).select("*").single()
  if (error) throw error
  return data
}

export async function updateProject(id: string, patch: ProjectUpdate): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single()
  if (error) throw error
  return data
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id)
  if (error) throw error
}

export async function listProjectManagers(): Promise<ProjectManager[]> {
  const { data, error } = await supabase.from("project_managers").select("*")
  if (error) throw error
  return data
}

// Reemplaza el gerente responsable de un proyecto por una única persona (o
// lo limpia si personId es null). El esquema soporta varios gerentes por
// proyecto (project_managers es una tabla puente), pero la UI de este
// módulo pide uno solo, como en el ejemplo del spec (Azul → Gerente Juan).
export async function setProjectManager(
  projectId: string,
  personId: string | null
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("project_managers")
    .delete()
    .eq("project_id", projectId)
  if (deleteError) throw deleteError

  if (personId) {
    const { error: insertError } = await supabase
      .from("project_managers")
      .insert({ project_id: projectId, person_id: personId, is_primary: true })
    if (insertError) throw insertError
  }
}

export async function listProjectMembers(): Promise<ProjectMember[]> {
  const { data, error } = await supabase.from("project_members").select("*")
  if (error) throw error
  return data
}

// Reemplaza de una sola vez la lista de colaboradores de un proyecto por
// `personIds`: borra los que ya no están y agrega los nuevos. Así el
// multi-select del formulario no tiene que calcular el diff — manda la
// lista completa deseada y esta función decide qué insertar/borrar.
export async function setProjectMembers(
  projectId: string,
  personIds: string[]
): Promise<void> {
  const { data: existing, error: listError } = await supabase
    .from("project_members")
    .select("person_id")
    .eq("project_id", projectId)
  if (listError) throw listError

  const existingIds = new Set((existing ?? []).map((row) => row.person_id))
  const nextIds = new Set(personIds)

  const toRemove = [...existingIds].filter((id) => !nextIds.has(id))
  const toAdd = [...nextIds].filter((id) => !existingIds.has(id))

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .in("person_id", toRemove)
    if (error) throw error
  }

  if (toAdd.length > 0) {
    const { error } = await supabase.from("project_members").insert(
      toAdd.map((personId) => ({ project_id: projectId, person_id: personId }))
    )
    if (error) throw error
  }
}
