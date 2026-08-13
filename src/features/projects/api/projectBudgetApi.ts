import { supabase } from "@/lib/supabaseClient"
import type { Database } from "@/types/database.types"

// El CRUD del proyecto en sí vive en projectsApi.ts — este módulo cubre lo
// que cuelga de él: fases, gastos, tarifas y las vistas de consumo.
export type ProjectPhase = Database["public"]["Tables"]["project_phases"]["Row"]
export type ProjectPhaseInsert = Database["public"]["Tables"]["project_phases"]["Insert"]
export type ProjectPhaseUpdate = Database["public"]["Tables"]["project_phases"]["Update"]

export type ProjectExpense = Database["public"]["Tables"]["project_expenses"]["Row"]
export type ProjectExpenseInsert =
  Database["public"]["Tables"]["project_expenses"]["Insert"]

export type ProjectTotals =
  Database["public"]["Views"]["v_project_totals"]["Row"]
export type ProjectCost = Database["public"]["Views"]["v_project_cost"]["Row"]
export type PhaseTotals = Database["public"]["Views"]["v_project_phase_totals"]["Row"]
export type PhaseCost = Database["public"]["Views"]["v_project_phase_cost"]["Row"]

// ---------------------------------------------------------------------------
// Consumo contra presupuesto
// ---------------------------------------------------------------------------

export async function listProjectTotals(): Promise<ProjectTotals[]> {
  const { data, error } = await supabase
    .from("v_project_totals")
    .select("*")
    .order("name", { ascending: true })
  if (error) throw error
  return data
}

// El costo de nómina vive en una vista aparte porque necesita leer las
// tarifas, que son solo de Administrador. Para un rol sin acceso la vista no
// devuelve filas — de ahí que esto sea un array vacío y no un error, y que
// la UI tenga que tratar "sin dato" como distinto de "cero".
export async function listProjectCosts(): Promise<ProjectCost[]> {
  const { data, error } = await supabase.from("v_project_cost").select("*")
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------

export async function listPhases(projectId: string): Promise<ProjectPhase[]> {
  const { data, error } = await supabase
    .from("project_phases")
    .select("*")
    .eq("project_id", projectId)
    .order("position", { ascending: true })
  if (error) throw error
  return data
}

export async function listPhaseTotals(projectId: string): Promise<PhaseTotals[]> {
  const { data, error } = await supabase
    .from("v_project_phase_totals")
    .select("*")
    .eq("project_id", projectId)
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

export async function listExpenses(projectId: string): Promise<ProjectExpense[]> {
  const { data, error } = await supabase
    .from("project_expenses")
    .select("*")
    .eq("project_id", projectId)
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
