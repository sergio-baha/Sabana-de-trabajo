import { useState } from "react"
import { KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import ResetPasswordDialog from "@/features/settings/components/ResetPasswordDialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useProfiles } from "@/hooks/useProfiles"
import {
  useSetProfileActive,
  useUpdateProfileJobTitle,
  useUpdateProfileName,
  useUpdateProfileRole,
  useUpdateUserEmail,
} from "@/features/settings/hooks/useUsersQueries"
import { useSessionStore } from "@/stores/sessionStore"
import { ASSIGNABLE_ROLES, roleLabel } from "@/lib/roles"
import type { AppRole } from "@/types/database.types"

export default function UsersTable() {
  const profile = useSessionStore((s) => s.profile)
  const { data: profiles, isLoading } = useProfiles()
  const updateRole = useUpdateProfileRole()
  const setActive = useSetProfileActive()
  const updateJobTitle = useUpdateProfileJobTitle()
  const updateName = useUpdateProfileName()
  const updateEmail = useUpdateUserEmail()
  const [userToReset, setUserToReset] = useState<{
    id: string
    full_name: string
    email: string
  } | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuarios</CardTitle>
        <CardDescription>
          Nombre, correo de acceso, cargo, rol y estado. Los campos se guardan al salir de
          ellos. Activar una cuenta la suma sola al equipo de los meses abiertos; desactivarla
          la retira sin borrar su historial.
        </CardDescription>
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
                <TableHead>Correo</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead>Acceso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles?.map((p) => {
                const isSelf = p.id === profile?.id
                return (
                  <TableRow key={p.id}>
                    {/* Nombre y correo se editan en línea, como el cargo. El
                        nombre es una columna de `profiles`; el correo es el de
                        acceso y va por RPC, porque vive en auth.users. */}
                    <TableCell>
                      <Input
                        defaultValue={p.full_name}
                        aria-label={`Nombre de ${p.full_name}`}
                        className="h-8 w-48 font-medium"
                        onBlur={(e) => {
                          const next = e.target.value.trim()
                          if (!next || next === p.full_name) {
                            e.target.value = p.full_name
                            return
                          }
                          updateName.mutate({ id: p.id, fullName: next })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur()
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="email"
                        defaultValue={p.email}
                        aria-label={`Correo de ${p.full_name}`}
                        className="h-8 w-56"
                        onBlur={(e) => {
                          const next = e.target.value.trim().toLowerCase()
                          if (!next || next === p.email) {
                            e.target.value = p.email
                            return
                          }
                          updateEmail.mutate({ id: p.id, email: next })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur()
                        }}
                      />
                    </TableCell>
                    {/* El cargo vive en la cuenta y baja solo al roster de los
                        meses abiertos. Se guarda al salir del campo, sin
                        botón: es un dato que se escribe una vez y no vuelve a
                        tocarse. */}
                    <TableCell>
                      <Input
                        defaultValue={p.job_title ?? ""}
                        placeholder="Sin cargo"
                        aria-label={`Cargo de ${p.full_name}`}
                        className="h-8 w-44"
                        onBlur={(e) => {
                          const next = e.target.value.trim()
                          if (next === (p.job_title ?? "")) return
                          updateJobTitle.mutate({ id: p.id, jobTitle: next })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur()
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={p.role}
                        onValueChange={(role) => updateRole.mutate({ id: p.id, role: role as AppRole })}
                        disabled={isSelf}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNABLE_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {roleLabel[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={p.is_active}
                        disabled={isSelf}
                        onCheckedChange={(checked) => setActive.mutate({ id: p.id, isActive: checked })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUserToReset(p)}
                      >
                        <KeyRound /> Contraseña
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <ResetPasswordDialog
        user={userToReset}
        onOpenChange={(open) => !open && setUserToReset(null)}
      />
    </Card>
  )
}
