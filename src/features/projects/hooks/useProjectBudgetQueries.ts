import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  clearPersonRate,
  createExpense,
  createPhase,
  deleteExpense,
  deletePhase,
  listExpenses,
  listPersonRates,
  listPhaseCosts,
  listPhaseTotals,
  listPhases,
  listProjectCosts,
  listProjectTotals,
  reorderPhases,
  setPersonRate,
  updatePhase,
  type ProjectExpenseInsert,
  type ProjectPhaseInsert,
  type ProjectPhaseUpdate,
} from "@/features/projects/api/projectBudgetApi"

export const budgetKeys = {
  totals: ["project_totals"] as const,
  costs: ["project_costs"] as const,
  phases: (projectId: string) => ["project_phases", projectId] as const,
  phaseTotals: (projectId: string) => ["project_phase_totals", projectId] as const,
  phaseCosts: ["project_phase_costs"] as const,
  expenses: (projectId: string) => ["project_expenses", projectId] as const,
  rates: (monthId: string) => ["person_rates", monthId] as const,
}

// Cualquier cosa que mueva horas, gastos o presupuesto cambia las cifras de
// consumo, que viven en cuatro vistas distintas. Se invalidan juntas para no
// dejar una tarjeta mostrando el total viejo al lado de una actualizada.
export function invalidateTotals(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: budgetKeys.totals })
  queryClient.invalidateQueries({ queryKey: budgetKeys.costs })
  queryClient.invalidateQueries({ queryKey: budgetKeys.phaseCosts })
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------

export function useProjectTotals() {
  return useQuery({ queryKey: budgetKeys.totals, queryFn: listProjectTotals })
}

export function useProjectCosts() {
  return useQuery({ queryKey: budgetKeys.costs, queryFn: listProjectCosts })
}

export function usePhases(projectId: string | null) {
  return useQuery({
    queryKey: budgetKeys.phases(projectId ?? ""),
    queryFn: () => listPhases(projectId as string),
    enabled: Boolean(projectId),
  })
}

export function usePhaseTotals(projectId: string | null) {
  return useQuery({
    queryKey: budgetKeys.phaseTotals(projectId ?? ""),
    queryFn: () => listPhaseTotals(projectId as string),
    enabled: Boolean(projectId),
  })
}

export function usePhaseCosts() {
  return useQuery({ queryKey: budgetKeys.phaseCosts, queryFn: listPhaseCosts })
}

export function useExpenses(projectId: string | null) {
  return useQuery({
    queryKey: budgetKeys.expenses(projectId ?? ""),
    queryFn: () => listExpenses(projectId as string),
    enabled: Boolean(projectId),
  })
}

export function usePersonRates(monthId: string | null) {
  return useQuery({
    queryKey: budgetKeys.rates(monthId ?? ""),
    queryFn: () => listPersonRates(monthId as string),
    enabled: Boolean(monthId),
  })
}

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------

export function useCreatePhase(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProjectPhaseInsert) => createPhase(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.phases(projectId) })
      queryClient.invalidateQueries({ queryKey: budgetKeys.phaseTotals(projectId) })
      toast.success("Fase agregada")
    },
    onError: (error) => toast.error("No se pudo agregar la fase", { description: error.message }),
  })
}

export function useUpdatePhase(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ProjectPhaseUpdate }) =>
      updatePhase(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.phases(projectId) })
      queryClient.invalidateQueries({ queryKey: budgetKeys.phaseTotals(projectId) })
      invalidateTotals(queryClient)
    },
    onError: (error) =>
      toast.error("No se pudo actualizar la fase", { description: error.message }),
  })
}

export function useDeletePhase(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePhase(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.phases(projectId) })
      queryClient.invalidateQueries({ queryKey: budgetKeys.phaseTotals(projectId) })
      invalidateTotals(queryClient)
      toast.success("Fase eliminada")
    },
    onError: (error) => toast.error("No se pudo eliminar la fase", { description: error.message }),
  })
}

export function useReorderPhases(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (orderedIds: string[]) => reorderPhases(orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.phases(projectId) })
      queryClient.invalidateQueries({ queryKey: budgetKeys.phaseTotals(projectId) })
    },
    onError: (error) =>
      toast.error("No se pudo reordenar las fases", { description: error.message }),
  })
}

// ---------------------------------------------------------------------------
// Gastos
// ---------------------------------------------------------------------------

export function useCreateExpense(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProjectExpenseInsert) => createExpense(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.expenses(projectId) })
      queryClient.invalidateQueries({ queryKey: budgetKeys.phaseTotals(projectId) })
      invalidateTotals(queryClient)
      toast.success("Gasto registrado")
    },
    onError: (error) => toast.error("No se pudo registrar el gasto", { description: error.message }),
  })
}

export function useDeleteExpense(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.expenses(projectId) })
      queryClient.invalidateQueries({ queryKey: budgetKeys.phaseTotals(projectId) })
      invalidateTotals(queryClient)
      toast.success("Gasto eliminado")
    },
    onError: (error) => toast.error("No se pudo eliminar el gasto", { description: error.message }),
  })
}

// ---------------------------------------------------------------------------
// Tarifas
// ---------------------------------------------------------------------------

export function useSetPersonRate(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ personId, hourlyRate }: { personId: string; hourlyRate: number }) =>
      setPersonRate(personId, monthId, hourlyRate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.rates(monthId) })
      invalidateTotals(queryClient)
      toast.success("Tarifa actualizada")
    },
    onError: (error) =>
      toast.error("No se pudo guardar la tarifa", { description: error.message }),
  })
}

export function useClearPersonRate(monthId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (personId: string) => clearPersonRate(personId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.rates(monthId) })
      invalidateTotals(queryClient)
      toast.success("Tarifa eliminada")
    },
    onError: (error) =>
      toast.error("No se pudo eliminar la tarifa", { description: error.message }),
  })
}
