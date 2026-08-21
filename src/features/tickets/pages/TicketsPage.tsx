import { useMemo, useState } from "react"
import { Inbox, LifeBuoy, Mail, UserPlus } from "lucide-react"
import PageHeader from "@/components/shared/PageHeader"
import EmptyState from "@/components/shared/EmptyState"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useSessionStore } from "@/stores/sessionStore"
import { canAssignTickets, isAnalistaTecnologia, seesTickets } from "@/lib/roles"
import {
  useAssignTicket,
  useReleaseTicket,
  useTakeTicket,
  useTickets,
} from "@/features/tickets/hooks/useTicketsQueries"
import { personInMonth } from "@/features/tickets/api/ticketsApi"
import { useTaskAssignees } from "@/features/tasks/hooks/useTasksQueries"
import AssignTicketDialog from "@/features/tickets/components/AssignTicketDialog"
import type { Ticket } from "@/features/tickets/api/ticketsApi"

// La bandeja de la mesa de ayuda.
//
// Un ticket entra SIN DUEÑO y le sale a todo Analista de Tecnología: esa es
// la diferencia con el tablero, donde cada quien ve lo suyo. Acá se ve la
// cola compartida y se decide quién atiende qué.
//
// No hay filtro de mes. El trabajo de soporte no se corta por mes — el mes
// del ticket es un detalle de implementación (`tasks.month_id` es NOT NULL) y
// para quien atiende es irrelevante.
export default function TicketsPage() {
  const profile = useSessionStore((s) => s.profile)
  const canSee = seesTickets(profile?.role)

  const { data: tickets, isLoading } = useTickets(canSee)
  const { data: assignees } = useTaskAssignees(null, { allMonths: true })

  const takeTicket = useTakeTicket()
  const releaseTicket = useReleaseTicket()
  const assignTicket = useAssignTicket()

  const [ticketToAssign, setTicketToAssign] = useState<Ticket | null>(null)

  const assigneeByTask = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of assignees ?? []) map.set(a.task_id, a.person_id)
    return map
  }, [assignees])

  const { sinDueno, atendidos } = useMemo(() => {
    const all = tickets ?? []
    return {
      sinDueno: all.filter((t) => !assigneeByTask.has(t.id)),
      atendidos: all.filter((t) => assigneeByTask.has(t.id)),
    }
  }, [tickets, assigneeByTask])

  // Tomar exige MI fila de roster del mes DEL TICKET, no la del mes activo.
  // Si no la tengo, el ticket aterrizó en un mes donde no estoy en el roster
  // y hay que avisarlo en vez de fallar con un error de llave foránea.
  async function handleTake(ticket: Ticket) {
    if (!profile) return
    const personId = await personInMonth(ticket.month_id, profile.id)
    if (!personId) {
      throw new Error(
        "No tienes fila en el roster del mes de este ticket. Pídele a un administrador que te agregue."
      )
    }
    takeTicket.mutate([ticket.id, ticket.month_id, personId])
  }

  if (!canSee) return null

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LifeBuoy}
        eyebrow="Soporte"
        title="Mesa de ayuda"
        description="Tickets que llegan por correo a soporte. Entran sin dueño: tómalos o repártelos."
        stats={[
          { label: "Sin atender", value: sinDueno.length },
          { label: "En curso", value: atendidos.length },
        ]}
      />

      <section className="space-y-3">
        <h2 className="text-eyebrow text-muted-foreground">Sin dueño</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : sinDueno.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nada pendiente de tomar"
            description="Todo lo que ha llegado ya tiene a alguien atendiéndolo."
          />
        ) : (
          sinDueno.map((ticket) => (
            <Card key={ticket.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">#{ticket.ticket_number}</Badge>
                  <span className="truncate font-medium">{ticket.title}</span>
                </div>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="size-3.5 shrink-0" />
                  <span className="truncate">{ticket.requester_email}</span>
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {isAnalistaTecnologia(profile?.role) && (
                  <Button size="sm" onClick={() => handleTake(ticket)}>
                    Tomar
                  </Button>
                )}
                {canAssignTickets(profile?.role) && (
                  <Button size="sm" variant="outline" onClick={() => setTicketToAssign(ticket)}>
                    <UserPlus /> Asignar
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-eyebrow text-muted-foreground">En curso</h2>
        {atendidos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ningún ticket asignado todavía.</p>
        ) : (
          atendidos.map((ticket) => (
            <Card key={ticket.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">#{ticket.ticket_number}</Badge>
                  <span className="truncate font-medium">{ticket.title}</span>
                  <Badge variant="secondary">{ticket.status}</Badge>
                </div>
                <p className="truncate text-sm text-muted-foreground">{ticket.requester_email}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                {canAssignTickets(profile?.role) && (
                  <Button size="sm" variant="outline" onClick={() => setTicketToAssign(ticket)}>
                    Reasignar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => releaseTicket.mutate([ticket.id])}
                >
                  Devolver a la bandeja
                </Button>
              </div>
            </Card>
          ))
        )}
      </section>

      <AssignTicketDialog
        ticket={ticketToAssign}
        onOpenChange={(open) => !open && setTicketToAssign(null)}
        onAssign={(personId) => {
          if (!ticketToAssign) return
          assignTicket.mutate([ticketToAssign.id, ticketToAssign.month_id, personId])
          setTicketToAssign(null)
        }}
      />
    </div>
  )
}
