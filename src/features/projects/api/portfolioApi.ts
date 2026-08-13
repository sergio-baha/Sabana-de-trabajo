import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/types/database.types"

export type PortfolioProject = Database["public"]["Tables"]["portfolio_projects"]["Row"]
export type PortfolioProjectInsert =
  Database["public"]["Tables"]["portfolio_projects"]["Insert"]
export type PortfolioProjectUpdate =
  Database["public"]["Tables"]["portfolio_projects"]["Update"]

export type ProjectPhase = Database["public"]["Tables"]["project_phases"]["Row"]
export type ProjectPhaseInsert = Database["public"]["Tables"]["project_phases"]["Insert"]
export type ProjectPhaseUpdate = Database["public"]["Tables"]["project_phases"]["Update"]

export type ProjectExpense = Database["public"]["Tables"]["project_expenses"]["Row"]
export type ProjectExpenseInsert =
  Database["public"]["Tables"]["project_expenses"]["Insert"]

export type PortfolioTotals =
  Database["public"]["Views"]["v_portfolio_project_totals"]["Row"]
export type PortfolioCost = Database["public"]["Views"]["v_portfolio_project_cost"]["Row"]
export type PhaseTotals = Database["public"]["Views"]["v_project_phase_totals"]["Row"]
export type PhaseCost = Database["public"]["Views"]["v_project_phase_cost"]["Row"]

// ---------------------------------------------------------------------------
// Proyectos del portafolio
// ---------------------------------------------------------------------------

export async function listPortfolioProjects(): Promise<PortfolioProject[]> {
  const { data, error } = await supabase
    .from("portfolio_projects")
    .select("*")
    .order("name", { ascending: true })
  if (error) throw error
  return data
}

export async function getPortfolioProject(id: string): Promise<PortfolioProject> {
  const { data, error } = await supabase
    .from("portfolio_projects")
    .select("*")
    .eq("id", id)
    .single()
  if (error) throw error
  return data
}

export async function createPortfolioProject(
  input: PortfolioProjectInsert
): Promise<PortfolioProject> {
  const { data, error } = await supabase
    .from("portfolio_projects")
    .insert(input)
    .select("*")
    .single()
  if (error) throw error
  return data
}

export async function updatePortfolioProject(
  id: string,
  patch: PortfolioProjectUpdate
): Promise<PortfolioProject> {
  const { data, error } = await supabase
    .from("portfolio_projects")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single()
  if (error) throw error
  return data
}

export async function deletePortfolioProject(id: string): Promise<void> {
  const { error } = await supabase.from("portfolio_projects").delete().eq("id", id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Consumo contra presupuesto
// ---------------------------------------------------------------------------

export async function listPortfolioTotals(): Promise<PortfolioTotals[]> {
  const { data, error } = await supabase
    .from("v_portfolio_project_totals")
    .select("*")
    .order("name", { ascending: true })
  if (error) throw error
  return data
}

// El costo de nómina vive en una vista aparte porque necesita leer las
// tarifas, que son solo de Administrador. Para un rol sin acceso la vista no
// devuelve filas — de ahí que esto sea un array vacío y no un error, y que
// la UI tenga que tratar "sin dato" como distinto de "cero".
export async function listPortfolioCosts(): Promise<PortfolioCost[]> {
  const { data, error } = await supabase.from("v_portfolio_project_cost").select("*")
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------

export async function listPhases(portfolioProjectId: string): Promise<ProjectPhase[]> {
  const { data, error } = await supabase
    .from("project_phases")
    .select("*")
    .eq("portfolio_project_id", portfolioProjectId)
    .order("position", { ascending: true })
  if (error) throw error
  return data
}

// Las fases cuelgan del portafolio, pero casi toda la app trabaja con la
// fila MENSUAL del proyecto (allocations, tareas, actividades apuntan ahí).
// Este atajo hace el salto para que los diálogos de actividad no tengan que
// conocer la existencia del portafolio.
export async function listPhasesForMonthlyProject(
  monthlyProjectId: string
): Promise<ProjectPhase[]> {
  const { data: project, error } = await supabase
    .from("projects")
    .select("portfolio_project_id")
    .eq("id", monthlyProjectId)
    .single()
  if (error) throw error
  if (!project.portfolio_project_id) return []
  return listPhases(project.portfolio_project_id)
}

export async function listPhaseTotals(portfolioProjectId: string): Promise<PhaseTotals[]> {
  const { data, error } = await supabase
    .from("v_project_phase_totals")
    .select("*")
    .eq("portfolio_project_id", portfolioProjectId)
    .order("position", { ascending: true })
  if (error) throw error
  return data
}

export async function listPhaseCosts(): Promise<PhaseCost[]> {
  const { data, error } = await supabase.from("v_project_phase_cost").select("*")
  if (error) throw error
  return data
}

export async function createPhase(input: ProjectPhaseInsert): Promise<ProjectPhase> {
  const { data, error } = await supabase
    .from("project_phases")
    .insert(input)
    .select("*")
    .single()
  if (error) throw error
  return data
}

export async function updatePhase(
  id: string,
  patch: ProjectPhaseUpdate
): Promise<ProjectPhase> {
  const { data, error } = await supabase
    .from("project_phases")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single()
  if (error) throw error
  return data
}

export async function deletePhase(id: string): Promise<void> {
  const { error } = await supabase.from("project_phases").delete().eq("id", id)
  if (error) throw error
}

// Reordenar es un update por fila. Se hace en paralelo y no en un `upsert`
// masivo a propósito: un upsert exigiría enviar la fila completa de cada
// fase, y con ello se arriesga pisar un cambio que otro usuario acabe de
// guardar en un campo que este cliente tiene desactualizado.
export async function reorderPhases(orderedIds: string[]): Promise<void> {
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("project_phases").update({ position: index }).eq("id", id)
    )
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) throw failed.error
}

// ---------------------------------------------------------------------------
// Gastos
// ---------------------------------------------------------------------------

export async function listExpenses(portfolioProjectId: string): Promise<ProjectExpense[]> {
  const { data, error } = await supabase
    .from("project_expenses")
    .select("*")
    .eq("portfolio_project_id", portfolioProjectId)
    .order("incurred_on", { ascending: false })
  if (error) throw error
  return data
}

export async function createExpense(input: ProjectExpenseInsert): Promise<ProjectExpense> {
  const { data, error } = await supabase
    .from("project_expenses")
    .insert(input)
    .select("*")
    .single()
  if (error) throw error
  return data
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from("project_expenses").delete().eq("id", id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Tarifas (solo Administrador)
// ---------------------------------------------------------------------------

export type PersonRate = Database["public"]["Tables"]["person_rates"]["Row"]

// Para cualquier rol que no sea Administrador, RLS devuelve cero filas sin
// error. La UI usa eso para esconder el módulo en vez de mostrar tarifas en
// blanco como si nadie tuviera una cargada.
export async function listPersonRates(monthId: string): Promise<PersonRate[]> {
  const { data, error } = await supabase
    .from("person_rates")
    .select("*")
    .eq("month_id", monthId)
  if (error) throw error
  return data
}

export async function setPersonRate(
  personId: string,
  monthId: string,
  hourlyRate: number
): Promise<void> {
  const { error } = await supabase
    .from("person_rates")
    .upsert({ person_id: personId, month_id: monthId, hourly_rate: hourlyRate })
  if (error) throw error
}

export async function clearPersonRate(personId: string): Promise<void> {
  const { error } = await supabase.from("person_rates").delete().eq("person_id", personId)
  if (error) throw error
}
