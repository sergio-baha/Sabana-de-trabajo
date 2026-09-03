import { useMemo, useState } from "react"
import { AlertCircle, ChevronLeft, ChevronRight, Clock, Mail, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useOutbox } from "@/features/settings/hooks/useOutboxQueries"
import { OUTBOX_PAGE_SIZE, outboxStatus, type OutboxMail, type OutboxStatus } from "@/features/settings/api/outboxApi"
import { cn } from "@/lib/utils"

const ALL = "all"

const KIND_LABELS: Record<string, string> = {
  ticket_creado: "Ticket creado",
  ticket_cerrado: "Ticket cerrado",
  ticket_reabierto: "Ticket reabierto",
  mes_liberado: "Mes liberado",
  revision_asignada: "Revisor asignado",
}

const kindLabel = (kind: string) => KIND_LABELS[kind] ?? kind

const STATUS_LABEL: Record<OutboxStatus, string> = {
  enviado: "Enviado",
  pendiente: "Pendiente",
  fallido: "Fallido",
}

const STATUS_CLASS: Record<OutboxStatus, string> = {
  enviado: "bg-success-muted text-success",
  pendiente: "bg-warning-muted text-warning",
  fallido: "bg-danger-muted text-danger",
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Historial de correos: qué se mandó, a quién, cuándo, y si de verdad salió
// — la misma bandeja que ya usan los tickets (outbox), extendida con "mes
// liberado" y "revisor asignado". Solo lectura: el envío lo hace el worker
// por cron, acá solo se audita.
export default function OutboxPanel() {
  const [search, setSearch] = useState("")
  const [kind, setKind] = useState(ALL)
  const [status, setStatus] = useState<OutboxStatus | typeof ALL>(ALL)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<OutboxMail | null>(null)

  const filters = useMemo(
    () => ({
      kind: kind === ALL ? undefined : kind,
      status: status === ALL ? undefined : status,
      search: search.trim() || undefined,
    }),
    [kind, status, search]
  )

  const { data, isLoading, isFetching } = useOutbox(filters, page)
  const totalPages = data ? Math.max(1, Math.ceil(data.count / OUTBOX_PAGE_SIZE)) : 1

  const resetPage = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value)
    setPage(0)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="filter-bar">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por destinatario o asunto…"
            className="pl-8"
            value={search}
            onChange={(e) => resetPage(setSearch)(e.target.value)}
          />
        </div>
        <Select value={kind} onValueChange={resetPage(setKind)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los tipos</SelectItem>
            {Object.entries(KIND_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={resetPage(setStatus) as (v: string) => void}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los estados</SelectItem>
            <SelectItem value="enviado">Enviado</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="fallido">Fallido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
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
                    <TableHead>Para</TableHead>
                    <TableHead>Asunto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Intentos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.rows.map((mail) => {
                    const st = outboxStatus(mail)
                    return (
                      <TableRow
                        key={mail.id}
                        className="cursor-pointer"
                        onClick={() => setSelected(mail)}
                      >
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatWhen(mail.created_at)}
                        </TableCell>
                        <TableCell className="max-w-48 truncate">{mail.to_email}</TableCell>
                        <TableCell className="max-w-64 truncate">{mail.subject}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {kindLabel(mail.kind)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="ghost" className={cn("w-fit", STATUS_CLASS[st])}>
                            {STATUS_LABEL[st]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {mail.attempts}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {data?.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Sin resultados para estos filtros.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Página {page + 1} de {totalPages} · {data?.count ?? 0} correos
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

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="size-4 shrink-0" />
              {selected?.subject}
            </DialogTitle>
            <DialogDescription>
              Para {selected?.to_email} · {kindLabel(selected?.kind ?? "")}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5" /> Encolado: {formatWhen(selected.created_at)}
                </span>
                {selected.sent_at && <span>Enviado: {formatWhen(selected.sent_at)}</span>}
                <span>Intentos: {selected.attempts}</span>
                <Badge
                  variant="ghost"
                  className={cn("w-fit", STATUS_CLASS[outboxStatus(selected)])}
                >
                  {STATUS_LABEL[outboxStatus(selected)]}
                </Badge>
              </div>

              {selected.last_error && (
                <div className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger-muted/30 p-3 text-xs text-danger">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span className="break-words">{selected.last_error}</span>
                </div>
              )}

              <div className="rounded-xl border border-border p-3 whitespace-pre-wrap">
                {selected.body}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
