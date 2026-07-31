import { useQuery } from "@tanstack/react-query"
import { listManagerTotals } from "@/features/reports/api/reportsApi"

export function useManagerTotals(monthId: string | null) {
  return useQuery({
    queryKey: ["v_manager_month_totals", monthId ?? ""],
    queryFn: () => listManagerTotals(monthId as string),
    enabled: Boolean(monthId),
  })
}
