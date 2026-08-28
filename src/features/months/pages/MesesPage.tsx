import { useState } from "react"
import {
  CalendarRange,
  CheckCircle2,
  Copy,
  EyeOff,
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react"
import PageHeader from "@/components/shared/PageHeader"
import { Badge } from "@/components/ui/badge"
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
import { canManageMonths } from "@/lib/roles"

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
  const [monthToRelease, setMonthToRelease] = useState<Month | null>(null)
  const [snapshotsMonth, setSnapshotsMonth] = useState<Month | null>(null)

  // Un solo permiso para todo el módulo: administrar meses es del
  // Administrador y solo él llega hasta acá (RoleRoute). El chequeo se
  // conserva porque la página no debe asumir cómo la enrutaron.
  const canWrite = canManageMonths(profile?.role)

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

  const openCount = (months ?? []).filter((m) => m.status === "abierto").length

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={CalendarRange}
        eyebrow="Configuración"
        title="Meses"
        description="Cada mes es una planificación independiente. Duplicar copia el roster y la distribución de horas del mes elegido; los proyectos son durables y las tareas se quedan en su mes."
        stats={[
          { label: "Meses", value: months?.length ?? 0 },
          { label: "Abiertos", value: openCount },
        ]}
        actions={
          canWrite && (
            <>
              <Button variant="outline" className="btn-press" onClick={openCreate}>
                <Plus /> Mes en blanco
              </Button>
              <Button
                className="btn-press"
                onClick={() => openDuplicate(activeMonthId ?? undefined)}
              >
                <Copy /> Duplicar mes
              </Button>
            </>
          )
        }
      />

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
                      <div className="flex flex-wrap items-center gap-1.5">
                        <MonthStatusBadge status={month.status} releasedAt={month.released_at} />
                        {month.planning_ready_at && !month.released_at && (
                          <Badge
                            variant="ghost"
                            className="bg-success-muted text-success"
                            title={`Marcado el ${new Date(month.planning_ready_at).toLocaleDateString("es-CO")}`}
                          >
                            <CheckCircle2 /> Planeación lista
                          </Badge>
                        )}
                      </div>
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
                          {/* Liberar es el acto que le muestra el mes al
                              equipo: mientras no ocurra, los analistas no ven
                              ni el mes ni sus tareas. Es manual a propósito —
                              el Administrador decide cuándo la sábana está
                              lista para trabajarse. */}
                          {canWrite && (
                            <DropdownMenuItem onClick={() => setMonthToRelease(month)}>
                              {month.released_at ? (
                                <>
                                  <EyeOff /> Volver a preparación
                                </>
                              ) : (
                                <>
                                  <Send /> Liberar al equipo
                                </>
                              )}
                            </DropdownMenuItem>
                          )}
                          {canWrite && (
                            <DropdownMenuItem onClick={() => openDuplicate(month.id)}>
                              <Copy /> Duplicar
                            </DropdownMenuItem>
                          )}
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
                          {canWrite && (
                            <DropdownMenuItem onClick={() => toggleArchived(month)}>
                              {month.status === "archivado" ? "Restaurar de archivo" : "Archivar"}
                            </DropdownMenuItem>
                          )}
                          {canWrite && (
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
        description="Se eliminarán su roster, sus horas repartidas y sus comentarios. Los proyectos no se tocan (son durables). Si el mes todavía tiene tarjetas en el tablero, la eliminación se detiene y te dice cuántas: archívalo en vez de borrarlo. Esta acción no se puede deshacer."
        onConfirm={async () => {
          if (!monthToDelete) return
          await deleteMonth.mutateAsync(monthToDelete.id)
          if (activeMonthId === monthToDelete.id) setActiveMonthId(null)
        }}
      />
      <ConfirmDialog
        open={Boolean(monthToRelease)}
        onOpenChange={(open) => !open && setMonthToRelease(null)}
        destructive={Boolean(monthToRelease?.released_at)}
        confirmLabel={monthToRelease?.released_at ? "Volver a preparación" : "Liberar"}
        title={
          monthToRelease?.released_at
            ? `Volver "${monthToRelease?.name}" a preparación`
            : `Liberar "${monthToRelease?.name}" al equipo`
        }
        description={
          monthToRelease?.released_at
            ? "El mes deja de verse para los analistas: no verán sus tareas ni sus horas hasta que lo vuelvas a liberar. El trabajo ya hecho no se pierde."
            : "Los analistas verán este mes, sus tareas y sus horas. Hazlo cuando la distribución y las actividades estén cargadas: es lo que le da luz verde al equipo."
        }
        onConfirm={async () => {
          if (!monthToRelease) return
          await updateMonth.mutateAsync({
            id: monthToRelease.id,
            // El servidor sella la fecha y el autor (trigger month_seal_release);
            // acá solo importa si va con marca o sin marca.
            patch: { released_at: monthToRelease.released_at ? null : new Date().toISOString() },
          })
          setMonthToRelease(null)
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
