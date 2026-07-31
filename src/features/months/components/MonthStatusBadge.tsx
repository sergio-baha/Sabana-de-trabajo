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

export default function MonthStatusBadge({ status }: { status: MonthStatus }) {
  return <Badge className={CLASSES[status]}>{LABELS[status]}</Badge>
}
