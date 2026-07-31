import { useQuery } from "@tanstack/react-query"
import { listAuditLogs, type AuditLogFilters } from "@/features/history/api/historyApi"

export function useAuditLogs(filters: AuditLogFilters, page: number) {
  return useQuery({
    queryKey: ["audit_logs", filters, page],
    queryFn: () => listAuditLogs(filters, page),
    placeholderData: (prev) => prev,
  })
}
