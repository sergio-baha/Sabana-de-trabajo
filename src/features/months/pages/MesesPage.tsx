import { useState } from "react"
import { Copy, History, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import MonthFormDialog from "@/features/months/components/MonthFormDialog"
import DuplicateMonthDialog from "@/features/months/components/DuplicateMonthDialog"
import MonthStatusBadge from "@/features/months/components/MonthStatusBadge"
import SnapshotsDialog from "@/features/snapshots/components/SnapshotsDialog"
import { useDeleteMonth, useMonths, useUpdateMonth } from "@/features/months/hooks/useMonthsQueries"
import type { Month } from "@/features/months/api/monthsApi"
import { useSessionStore } from "@/stores/sessionStore"
import { useActiveMonthStore } from "@/stores/activeMonthStore"
import { isAdmin, isGestorOrAdmin } from "@/lib/roles"

export default function MesesPage() {
  const profile = useSessionStore((s) => s.profile)
  const { data: months, isLoading } = useMonths()
  const updateMonth = useUpdateMonth()
  const deleteMonth = useDeleteMonth()
  const { activeMonthId, setActiveMonthId } = useActiveMonthStore()

  const [formOpen, setFormOpen] = useState(false)
  const [editingMonth, setEditingMonth] = useState<Month | null>(null)
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [duplicateSourceId, setDuplicateSourceId] = useState<string | undefined>()
  const [monthToDelete, setMonthToDelete] = useState<Month | null>(null)
  const [snapshotsMonth, setSnapshotsMonth] = useState<Month | null>(null)

  const canWrite = isGestorOrAdmin(profile?.role)
  const canArchive = isAdmin(profile?.role)

  const openCreate = () => {
    setEditingMonth(null)
    setFormOpen(true)
  }

  const openEdit = (month: Month) => {
    setEditingMonth(month)
    setFormOpen(true)
  }

  const openDuplicate = (sourceId?: string) => {
    setDuplicateSourceId(sourceId)
    setDuplicateOpen(true)
  }

  const toggleOpenClosed = (month: Month) => {
    updateMonth.mutate({
      id: month.id,
      patch: { status: month.status === "abierto" ? "cerrado" : "abierto" },
    })
  }

  const toggleArchived = (month: Month) => {
    updateMonth.mutate({
      id: month.id,
      patch: { status: month.status === "archivado" ? "abierto" : "archivado" },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Gestión de meses</h1>
          <p className="text-sm text-muted-foreground">
            Cada mes es una planificación independiente. Duplicar copia personas, proyectos y
            distribución del mes elegido.
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={openCreate}>
              <Plus /> Mes en blanco
            </Button>
            <Button onClick={() => openDuplicate(activeMonthId ?? undefined)}>
              <Copy /> Duplicar mes
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meses</CardTitle>
          <CardDescription>Selecciona un mes para trabajarlo en los demás módulos.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Horas por defecto</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {months?.map((month) => (
                  <TableRow
                    key={month.id}
                    data-active={month.id === activeMonthId}
                    className="data-[active=true]:bg-accent/60"
                  >
                    <TableCell>
                      <button
                        type="button"
                        className="font-medium hover:underline"
                        onClick={() => setActiveMonthId(month.id)}
                      >
                        {month.name}
                      </button>
                      {month.id === activeMonthId && (
                        <span className="ml-2 text-xs text-muted-foreground">(activo)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <MonthStatusBadge status={month.status} />
                    </TableCell>
                    <TableCell>{month.default_hours} h</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setActiveMonthId(month.id)}>
                            Marcar como activo
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openDuplicate(month.id)}>
                            <Copy /> Duplicar
                          </DropdownMenuItem>
                          {canWrite && (
                            <DropdownMenuItem onClick={() => setSnapshotsMonth(month)}>
                              <History /> Versiones
                            </DropdownMenuItem>
                          )}
                          {canWrite && (
                            <DropdownMenuItem onClick={() => openEdit(month)}>
                              <Pencil /> Editar
                            </DropdownMenuItem>
                          )}
                          {canWrite && month.status !== "archivado" && (
                            <DropdownMenuItem onClick={() => toggleOpenClosed(month)}>
                              {month.status === "abierto" ? "Cerrar mes" : "Reabrir mes"}
                            </DropdownMenuItem>
                          )}
                          {canArchive && (
                            <DropdownMenuItem onClick={() => toggleArchived(month)}>
                              {month.status === "archivado" ? "Restaurar de archivo" : "Archivar"}
                            </DropdownMenuItem>
                          )}
                          {canArchive && (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setMonthToDelete(month)}
                            >
                              <Trash2 /> Eliminar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {months?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Todavía no hay meses. Crea el primero con "Mes en blanco".
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <MonthFormDialog open={formOpen} onOpenChange={setFormOpen} month={editingMonth} />
      <DuplicateMonthDialog
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        months={months ?? []}
        defaultSourceId={duplicateSourceId}
      />
      <ConfirmDialog
        open={Boolean(monthToDelete)}
        onOpenChange={(open) => !open && setMonthToDelete(null)}
        title={`Eliminar "${monthToDelete?.name}"`}
        description="Se eliminarán también sus personas, proyectos, tareas y asignaciones. Esta acción no se puede deshacer."
        onConfirm={async () => {
          if (!monthToDelete) return
          await deleteMonth.mutateAsync(monthToDelete.id)
          if (activeMonthId === monthToDelete.id) setActiveMonthId(null)
        }}
      />
      {snapshotsMonth && (
        <SnapshotsDialog
          open
          onOpenChange={(open) => !open && setSnapshotsMonth(null)}
          monthId={snapshotsMonth.id}
          monthName={snapshotsMonth.name}
        />
      )}
    </div>
  )
}
