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
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useProfiles } from "@/hooks/useProfiles"
import { useSetProfileActive, useUpdateProfileRole } from "@/features/settings/hooks/useUsersQueries"
import { useSessionStore } from "@/stores/sessionStore"
import { roleLabel } from "@/lib/roles"
import type { AppRole } from "@/types/database.types"

export default function UsersTable() {
  const profile = useSessionStore((s) => s.profile)
  const { data: profiles, isLoading } = useProfiles()
  const updateRole = useUpdateProfileRole()
  const setActive = useSetProfileActive()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuarios</CardTitle>
        <CardDescription>Cambiar rol o desactivar una cuenta.</CardDescription>
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
                <TableHead>Rol</TableHead>
                <TableHead>Activo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles?.map((p) => {
                const isSelf = p.id === profile?.id
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.email}</TableCell>
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
                          {(["administrador", "gestor", "analista"] as const).map((role) => (
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
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
