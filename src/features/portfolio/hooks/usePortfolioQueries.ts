import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  clearPersonRate,
  createExpense,
  createPhase,
  createPortfolioProject,
  deleteExpense,
  deletePhase,
  deletePortfolioProject,
  getPortfolioProject,
  listExpenses,
  listPersonRates,
  listPhaseCosts,
  listPhaseTotals,
  listPhases,
  listPhasesForMonthlyProject,
  listPortfolioCosts,
  listPortfolioProjects,
  listPortfolioTotals,
  reorderPhases,
  setPersonRate,
  updatePhase,
  updatePortfolioProject,
  type PortfolioProjectInsert,
  type PortfolioProjectUpdate,
  type ProjectExpenseInsert,
  type ProjectPhaseInsert,
  type ProjectPhaseUpdate,
} from "@/features/portfolio/api/portfolioApi"

export const portfolioKeys = {
  projects: ["portfolio_projects"] as const,
  project: (id: string) => ["portfolio_projects", id] as const,
  totals: ["portfolio_totals"] as const,
  costs: ["portfolio_costs"] as const,
  phases: (projectId: string) => ["project_phases", projectId] as const,
  phaseTotals: (projectId: string) => ["project_phase_totals", projectId] as const,
  phaseCosts: ["project_phase_costs"] as const,
  expenses: (projectId: string) => ["project_expenses", projectId] as const,
  rates: (monthId: string) => ["person_rates", monthId] as const,
}

// Cualquier cosa que mueva horas, gastos o presupuesto cambia las cifras de
// consumo, que viven en cuatro vistas distintas. Se invalidan juntas para no
// dejar una tarjeta mostrando el total viejo al lado de una actualizada.
function invalidateTotals(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: portfolioKeys.totals })
  queryClient.invalidateQueries({ queryKey: portfolioKeys.costs })
  queryClient.invalidateQueries({ queryKey: portfolioKeys.phaseCosts })
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------

export function usePortfolioProjects() {
  return useQuery({ queryKey: portfolioKeys.projects, queryFn: listPortfolioProjects })
}

export function usePortfolioProject(id: string | null) {
  return useQuery({
    queryKey: portfolioKeys.project(id ?? ""),
    queryFn: () => getPortfolioProject(id as string),
    enabled: Boolean(id),
  })
}

export function usePortfolioTotals() {
  return useQuery({ queryKey: portfolioKeys.totals, queryFn: listPortfolioTotals })
}

export function usePortfolioCosts() {
  return useQuery({ queryKey: portfolioKeys.costs, queryFn: listPortfolioCosts })
}

export function usePhases(projectId: string | null) {
  return useQuery({
    queryKey: portfolioKeys.phases(projectId ?? ""),
    queryFn: () => listPhases(projectId as string),
    enabled: Boolean(projectId),
  })
}

// Para los diálogos de actividad, que solo conocen la fila mensual del
// proyecto. La clave se separa de `phases` porque el id que la indexa es
// otro (proyecto del mes, no del portafolio).
export function usePhasesForMonthlyProject(monthlyProjectId: string | null) {
  return useQuery({
    queryKey: ["project_phases_by_month_project", monthlyProjectId ?? ""],
    queryFn: () => listPhasesForMonthlyProject(monthlyProjectId as string),
    enabled: Boolean(monthlyProjectId),
  })
}

export function usePhaseTotals(projectId: string | null) {
  return useQuery({
    queryKey: portfolioKeys.phaseTotals(projectId ?? ""),
    queryFn: () => listPhaseTotals(projectId as string),
    enabled: Boolean(projectId),
  })
}

export function usePhaseCosts() {
  return useQuery({ queryKey: portfolioKeys.phaseCosts, queryFn: listPhaseCosts })
}

export function useExpenses(projectId: string | null) {
  return useQuery({
    queryKey: portfolioKeys.expenses(projectId ?? ""),
    queryFn: () => listExpenses(projectId as string),
    enabled: Boolean(projectId),
  })
}

export function usePersonRates(monthId: string | null) {
  return useQuery({
    queryKey: portfolioKeys.rates(monthId ?? ""),
    queryFn: () => listPersonRates(monthId as string),
    enabled: Boolean(monthId),
  })
}

// ---------------------------------------------------------------------------
// Proyecto del portafolio
// ---------------------------------------------------------------------------

export function useCreatePortfolioProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PortfolioProjectInsert) => createPortfolioProject(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.projects })
      invalidateTotals(queryClient)
      toast.success("Proyecto creado en el portafolio")
    },
    onError: (error) => toast.error("No se pudo crear el proyecto", { description: error.message }),
  })
}

export function useUpdatePortfolioProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PortfolioProjectUpdate }) =>
      updatePortfolioProject(id, patch),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.projects })
      queryClient.invalidateQueries({ queryKey: portfolioKeys.project(project.id) })
      invalidateTotals(queryClient)
      toast.success("Proyecto actualizado")
    },
    onError: (error) =>
      toast.error("No se pudo actualizar el proyecto", { description: error.message }),
  })
}

export function useDeletePortfolioProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePortfolioProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.projects })
      invalidateTotals(queryClient)
      toast.success("Proyecto eliminado del portafolio")
    },
    onError: (error) =>
      toast.error("No se pudo eliminar el proyecto", { description: error.message }),
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
      queryClient.invalidateQueries({ queryKey: portfolioKeys.phases(projectId) })
      queryClient.invalidateQueries({ queryKey: portfolioKeys.phaseTotals(projectId) })
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
      queryClient.invalidateQueries({ queryKey: portfolioKeys.phases(projectId) })
      queryClient.invalidateQueries({ queryKey: portfolioKeys.phaseTotals(projectId) })
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
      queryClient.invalidateQueries({ queryKey: portfolioKeys.phases(projectId) })
      queryClient.invalidateQueries({ queryKey: portfolioKeys.phaseTotals(projectId) })
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
      queryClient.invalidateQueries({ queryKey: portfolioKeys.phases(projectId) })
      queryClient.invalidateQueries({ queryKey: portfolioKeys.phaseTotals(projectId) })
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
      queryClient.invalidateQueries({ queryKey: portfolioKeys.expenses(projectId) })
      queryClient.invalidateQueries({ queryKey: portfolioKeys.phaseTotals(projectId) })
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
      queryClient.invalidateQueries({ queryKey: portfolioKeys.expenses(projectId) })
      queryClient.invalidateQueries({ queryKey: portfolioKeys.phaseTotals(projectId) })
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
      queryClient.invalidateQueries({ queryKey: portfolioKeys.rates(monthId) })
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
      queryClient.invalidateQueries({ queryKey: portfolioKeys.rates(monthId) })
      invalidateTotals(queryClient)
      toast.success("Tarifa eliminada")
    },
    onError: (error) =>
      toast.error("No se pudo eliminar la tarifa", { description: error.message }),
  })
}
