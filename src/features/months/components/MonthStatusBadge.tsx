import { Badge } from "@/components/ui/badge"
import type { MonthStatus } from "@/types/database.types"

const LABELS: Record<MonthStatus, string> = {
  abierto: "Abierto",
  cerrado: "Cerrado",
  archivado: "Archivado",
}

const CLASSES: Record<MonthStatus, string> = {
  abierto: "border-transparent bg-success text-success-foreground",
  cerrado: "border-transparent bg-warning text-warning-foreground",
  archivado: "border-transparent bg-muted text-muted-foreground",
}

interface MonthStatusBadgeProps {
  status: MonthStatus
  /** `months.released_at`. Sin liberar, el mes solo lo ve quien lo prepara. */
  releasedAt?: string | null
}

// "En preparación" gana al estado: mientras el mes no esté liberado, lo único
// que importa saber de un vistazo es que el equipo todavía no lo ve.
export default function MonthStatusBadge({ status, releasedAt }: MonthStatusBadgeProps) {
  if (releasedAt === null) {
    return (
      <Badge className="border-transparent bg-accent text-accent-foreground">En preparación</Badge>
    )
  }
  return <Badge className={CLASSES[status]}>{LABELS[status]}</Badge>
}
