import { useQuery } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { listSupportPeople, type Ticket } from "@/features/tickets/api/ticketsApi"

interface Props {
  ticket: Ticket | null
  onOpenChange: (open: boolean) => void
  onAssign: (personId: string) => void
}

// A quién se le puede endosar un ticket.
//
// Los candidatos salen del ROSTER DEL MES DEL TICKET, no del mes activo:
// `task_assignees.person_id` apunta a `people`, que es por mes, así que
// ofrecer a alguien que no tiene fila en ese mes produciría un error de llave
// foránea justo al confirmar — el peor momento para enterarse.
export default function AssignTicketDialog({ ticket, onOpenChange, onAssign }: Props) {
  const { data: candidates, isLoading } = useQuery({
    queryKey: ["support-people", ticket?.month_id],
    queryFn: () => listSupportPeople(ticket!.month_id),
    enabled: Boolean(ticket),
  })

  return (
    <Dialog open={Boolean(ticket)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar el ticket #{ticket?.ticket_number}</DialogTitle>
          <DialogDescription>
            Solo aparecen los Analistas de Tecnología que están en el roster del mes de este
            ticket.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : !candidates?.length ? (
          <p className="text-sm text-muted-foreground">
            Nadie del equipo de soporte tiene fila en el roster de ese mes. Agrégalo desde
            Personas y vuelve a intentarlo.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {candidates.map((person) => (
              <Button
                key={person.id}
                variant="outline"
                className="justify-start"
                onClick={() => onAssign(person.id)}
              >
                {person.name}
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
