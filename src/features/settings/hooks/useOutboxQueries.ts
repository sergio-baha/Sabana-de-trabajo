import { useQuery } from "@tanstack/react-query"
import { listOutbox, type OutboxFilters } from "@/features/settings/api/outboxApi"

export const outboxKeys = {
  list: (filters: OutboxFilters, page: number) => ["outbox", filters, page] as const,
}

export function useOutbox(filters: OutboxFilters, page: number) {
  return useQuery({
    queryKey: outboxKeys.list(filters, page),
    queryFn: () => listOutbox(filters, page),
    // El worker corre por cron cada minuto (ver outbox-worker): sin
    // refetch, un correo "pendiente" se quedaría viéndose así en pantalla
    // aunque ya haya salido hace rato.
    refetchInterval: 15_000,
  })
}
