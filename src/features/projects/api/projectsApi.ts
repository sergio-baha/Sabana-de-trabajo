import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/types/database.types"

export type Project = Database["public"]["Tables"]["projects"]["Row"]
export type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"]
export type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"]
export type ProjectManager = Database["public"]["Tables"]["project_managers"]["Row"]

export async function listProjects(monthId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("month_id", monthId)
    .order("name", { ascending: true })
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

export async function duplicateProject(project: Project): Promise<Project> {
  return createProject({
    month_id: project.month_id,
    name: `${project.name} (copia)`,
    color: project.color,
    status: project.status,
    description: project.description,
  })
}

export async function listProjectManagers(monthId: string): Promise<ProjectManager[]> {
  const { data, error } = await supabase
    .from("project_managers")
    .select("*")
    .eq("month_id", monthId)
  if (error) throw error
  return data
}

// Reemplaza el gerente responsable de un proyecto por una única persona (o
// lo limpia si personId es null). El esquema soporta varios gerentes por
// proyecto (project_managers es una tabla puente), pero la UI de este
// módulo pide uno solo, como en el ejemplo del spec (Azul → Gerente Juan).
export async function setProjectManager(
  monthId: string,
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
      .insert({ month_id: monthId, project_id: projectId, person_id: personId, is_primary: true })
    if (insertError) throw insertError
  }
}
