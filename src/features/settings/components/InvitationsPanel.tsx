import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Mail, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useInvitations,
  useInviteUser,
  useRevokeInvitation,
} from "@/features/settings/hooks/useInvitationsQueries"
import { roleLabel } from "@/lib/roles"
import type { InvitationStatus } from "@/types/database.types"

const schema = z.object({
  email: z.string().min(1, "Ingresa un correo").email("Correo inválido"),
  fullName: z.string().optional(),
  role: z.enum(["administrador", "gestor", "analista"]),
})

type FormValues = z.infer<typeof schema>

const STATUS_CLASS: Record<InvitationStatus, string> = {
  pendiente: "border-transparent bg-warning-muted text-warning",
  aceptada: "border-transparent bg-success-muted text-success",
  revocada: "border-transparent bg-muted text-muted-foreground",
}

const STATUS_LABEL: Record<InvitationStatus, string> = {
  pendiente: "Pendiente",
  aceptada: "Aceptada",
  revocada: "Revocada",
}

export default function InvitationsPanel() {
  const { data: invitations, isLoading } = useInvitations()
  const inviteUser = useInviteUser()
  const revoke = useRevokeInvitation()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", fullName: "", role: "analista" },
  })

  const onSubmit = async (values: FormValues) => {
    await inviteUser.mutateAsync(values)
    form.reset()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitaciones</CardTitle>
        <CardDescription>Invita a un nuevo usuario por correo.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-wrap items-end gap-2"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="min-w-56">
                  <FormLabel>Correo</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="persona@empresa.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem className="min-w-40">
                  <FormLabel>Nombre (opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rol</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(["administrador", "gestor", "analista"] as const).map((role) => (
                        <SelectItem key={role} value={role}>
                          {roleLabel[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <Button type="submit" disabled={inviteUser.isPending}>
              <Mail /> {inviteUser.isPending ? "Enviando…" : "Invitar"}
            </Button>
          </form>
        </Form>

        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Correo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations?.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.email}</TableCell>
                  <TableCell>{roleLabel[inv.role]}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_CLASS[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    {inv.status === "pendiente" && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Revocar invitación"
                        onClick={() => revoke.mutate(inv.id)}
                      >
                        <X />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {invitations?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Sin invitaciones todavía.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
