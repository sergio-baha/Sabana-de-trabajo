import { useMemo, useState } from "react"
import { MoreHorizontal, Pencil, Plus, Search, Trash2, Users } from "lucide-react"
import PageHeader from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import NoActiveMonth from "@/components/shared/NoActiveMonth"
import PersonFormDialog from "@/features/people/components/PersonFormDialog"
import { useDeletePerson, usePeople } from "@/features/people/hooks/usePeopleQueries"
import type { Person } from "@/features/people/api/peopleApi"
import { useActiveMonthStore } from "@/stores/activeMonthStore"
import { useSessionStore } from "@/stores/sessionStore"
import { isAdmin, isGestorOrAdmin } from "@/lib/roles"
import RatesCard from "@/features/portfolio/components/RatesCard"

export default function PersonasPage() {
  const { activeMonthId } = useActiveMonthStore()
  const profile = useSessionStore((s) => s.profile)
  const canWrite = isGestorOrAdmin(profile?.role)

  const { data: people, isLoading } = usePeople(activeMonthId)
  const deletePerson = useDeletePerson(activeMonthId ?? "")

  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null)

  const filtered = useMemo(() => {
    if (!people) return []
    const q = search.trim().toLowerCase()
    if (!q) return people
    return people.filter(
      (p) => p.name.toLowerCase().includes(q) || p.job_title?.toLowerCase().includes(q)
    )
  }, [people, search])

  const activeCount = (people ?? []).filter((p) => p.status === "activo").length
  const availableHours = (people ?? []).reduce((sum, p) => sum + p.available_hours, 0)

  if (!activeMonthId) return <NoActiveMonth />

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={Users}
        eyebrow="Configuración"
        title="Personas"
        description="Roster del mes activo: cargo, horas mensuales disponibles y estado."
        stats={[
          { label: "En el roster", value: people?.length ?? 0 },
          { label: "Activas", value: activeCount },
          { label: "Horas disponibles", value: availableHours, suffix: " h" },
        ]}
        actions={
          canWrite && (
            <Button
              className="hero-action shine-hover"
              onClick={() => {
                setEditingPerson(null)
                setFormOpen(true)
              }}
            >
              <Plus /> Nueva persona
            </Button>
          )
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o cargo…"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Horas disponibles</TableHead>
                  <TableHead>Estado</TableHead>
                  {canWrite && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell className="font-medium">{person.name}</TableCell>
                    <TableCell>{person.job_title || "—"}</TableCell>
                    <TableCell>{person.available_hours} h</TableCell>
                    <TableCell>
                      <Badge variant={person.status === "activo" ? "secondary" : "outline"}>
                        {person.status === "activo" ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingPerson(person)
                                setFormOpen(true)
                              }}
                            >
                              <Pencil /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setPersonToDelete(person)}
                            >
                              <Trash2 /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Sin resultados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Las tarifas son dato de nómina: la tarjeta solo se monta para
          Administrador. Para cualquier otro rol RLS devolvería cero filas
          igual, así que esto evita mostrar una tabla vacía y confusa. */}
      {activeMonthId && isAdmin(profile?.role) && (
        <RatesCard monthId={activeMonthId} people={people ?? []} />
      )}

      {activeMonthId && (
        <PersonFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          monthId={activeMonthId}
          person={editingPerson}
        />
      )}
      <ConfirmDialog
        open={Boolean(personToDelete)}
        onOpenChange={(open) => !open && setPersonToDelete(null)}
        title={`Eliminar a "${personToDelete?.name}"`}
        description="Se eliminarán también sus asignaciones de horas y comentarios asociados."
        onConfirm={async () => {
          if (personToDelete) await deletePerson.mutateAsync(personToDelete.id)
        }}
      />
    </div>
  )
}
