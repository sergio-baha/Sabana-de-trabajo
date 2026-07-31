import { useQuery } from "@tanstack/react-query"
import { listPersonTotals, listProjectTotals, listRecentChanges } from "@/features/dashboard/api/dashboardApi"

export function usePersonTotals(monthId: string | null) {
  return useQuery({
    queryKey: ["v_person_month_totals", monthId ?? ""],
    queryFn: () => listPersonTotals(monthId as string),
    enabled: Boolean(monthId),
  })
}

export function useProjectTotals(monthId: string | null) {
  return useQuery({
    queryKey: ["v_project_month_totals", monthId ?? ""],
    queryFn: () => listProjectTotals(monthId as string),
    enabled: Boolean(monthId),
  })
}

export function useRecentChanges(monthId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["recent_changes", monthId ?? ""],
    queryFn: () => listRecentChanges(monthId as string),
    enabled: Boolean(monthId) && enabled,
  })
}
