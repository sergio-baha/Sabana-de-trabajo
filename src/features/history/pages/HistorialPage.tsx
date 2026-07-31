import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuditLogs } from "@/features/history/hooks/useHistoryQueries"
import { AUDIT_PAGE_SIZE } from "@/features/history/api/historyApi"
import { actionLabel, fieldLabel, tableLabel, TABLE_LABELS } from "@/features/history/lib/auditLabels"
import { useMonths } from "@/features/months/hooks/useMonthsQueries"
import { useProfiles } from "@/hooks/useProfiles"

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function HistorialPage() {
  const { data: months } = useMonths()
  const { byId: profilesById, data: profiles } = useProfiles()

  const [monthId, setMonthId] = useState<string>("all")
  const [tableName, setTableName] = useState<string>("all")
  const [changedBy, setChangedBy] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)

  const filters = useMemo(
    () => ({
      monthId: monthId === "all" ? undefined : monthId,
      tableName: tableName === "all" ? undefined : tableName,
      changedBy: changedBy === "all" ? undefined : changedBy,
      search: search.trim() || undefined,
    }),
    [monthId, tableName, changedBy, search]
  )

  const { data, isLoading, isFetching } = useAuditLogs(filters, page)
  const totalPages = data ? Math.max(1, Math.ceil(data.count / AUDIT_PAGE_SIZE)) : 1

  const resetPage = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value)
    setPage(0)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Historial</h1>
        <p className="text-sm text-muted-foreground">
          Todos los cambios registrados: usuario, fecha, campo modificado, valor anterior y nuevo.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar en los valores…"
            className="pl-8"
            value={search}
            onChange={(e) => resetPage(setSearch)(e.target.value)}
          />
        </div>
        <Select value={monthId} onValueChange={resetPage(setMonthId)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los meses</SelectItem>
            {months?.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tableName} onValueChange={resetPage(setTableName)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tabla" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las tablas</SelectItem>
            {Object.entries(TABLE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={changedBy} onValueChange={resetPage(setChangedBy)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Usuario" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los usuarios</SelectItem>
            {profiles?.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cambios registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Tabla</TableHead>
                    <TableHead>Campo</TableHead>
                    <TableHead>Antes</TableHead>
                    <TableHead>Después</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.rows.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatWhen(log.changed_at)}
                      </TableCell>
                      <TableCell>
                        {log.changed_by ? profilesById.get(log.changed_by)?.full_name ?? "—" : "Sistema"}
                      </TableCell>
                      <TableCell>{actionLabel(log.action)}</TableCell>
                      <TableCell>{tableLabel(log.table_name)}</TableCell>
                      <TableCell>{fieldLabel(log.field_name) ?? "—"}</TableCell>
                      <TableCell className="max-w-40 truncate text-xs text-muted-foreground">
                        {log.old_value ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-40 truncate text-xs">{log.new_value ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                  {data?.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Sin resultados para estos filtros.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Página {page + 1} de {totalPages} · {data?.count ?? 0} cambios
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page === 0 || isFetching}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page + 1 >= totalPages || isFetching}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
