import { useState } from "react"
import { History, RotateCcw, Save, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import {
  useCreateSnapshot,
  useDeleteSnapshot,
  useRestoreSnapshot,
  useSnapshots,
} from "@/features/snapshots/hooks/useSnapshotsQueries"
import type { MonthSnapshot } from "@/features/snapshots/api/snapshotsApi"
import { useProfiles } from "@/hooks/useProfiles"
import { useSessionStore } from "@/stores/sessionStore"
import { isAdmin } from "@/lib/roles"

interface SnapshotsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  monthId: string
  monthName: string
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

export default function SnapshotsDialog({
  open,
  onOpenChange,
  monthId,
  monthName,
}: SnapshotsDialogProps) {
  const profile = useSessionStore((s) => s.profile)
  const { byId: profilesById } = useProfiles()
  const { data: snapshots, isLoading } = useSnapshots(monthId)
  const createSnapshot = useCreateSnapshot(monthId)
  const restoreSnapshot = useRestoreSnapshot(monthId)
  const deleteSnapshot = useDeleteSnapshot(monthId)

  const [label, setLabel] = useState("")
  const [toRestore, setToRestore] = useState<MonthSnapshot | null>(null)
  const [toDelete, setToDelete] = useState<MonthSnapshot | null>(null)

  const handleSave = async () => {
    await createSnapshot.mutateAsync(label.trim() || null)
    setLabel("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4" /> Versiones de {monthName}
          </DialogTitle>
          <DialogDescription>
            Guarda un punto de restauración del roster y el reparto de horas de este mes. Los
            proyectos y las tareas no forman parte de la versión: no se tocan al restaurar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Etiqueta (opcional, ej. Antes del cierre)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button onClick={handleSave} disabled={createSnapshot.isPending}>
            <Save /> Guardar versión
          </Button>
        </div>

        <ScrollArea className="max-h-80">
          <div className="flex flex-col gap-2 pr-3">
            {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
            {!isLoading && snapshots?.length === 0 && (
              <p className="text-sm text-muted-foreground">Todavía no hay versiones guardadas.</p>
            )}
            {snapshots?.map((snap) => (
              <div
                key={snap.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border p-2"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{snap.label || "Versión sin etiqueta"}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatWhen(snap.created_at)}
                    {snap.created_by && ` · ${profilesById.get(snap.created_by)?.full_name ?? ""}`}
                  </span>
                </div>
                {isAdmin(profile?.role) && (
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      title="Restaurar esta versión"
                      onClick={() => setToRestore(snap)}
                    >
                      <RotateCcw />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Eliminar versión"
                      onClick={() => setToDelete(snap)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>

      <ConfirmDialog
        open={Boolean(toRestore)}
        onOpenChange={(o) => !o && setToRestore(null)}
        title={`Restaurar "${toRestore?.label || "esta versión"}"`}
        description="Devuelve el roster y el reparto de horas del mes al estado de esta versión. Las horas repartidas después de guardarla se perderán. Los proyectos, las tareas y los comentarios no se tocan; a nadie se le borra del roster."
        confirmLabel="Restaurar"
        onConfirm={async () => {
          if (toRestore) await restoreSnapshot.mutateAsync(toRestore.id)
        }}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Eliminar versión"
        description="Esta versión guardada se eliminará permanentemente."
        onConfirm={async () => {
          if (toDelete) await deleteSnapshot.mutateAsync(toDelete.id)
        }}
      />
    </Dialog>
  )
}
