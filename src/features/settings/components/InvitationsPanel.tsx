import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Mail, UserPlus, X } from "lucide-react"
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
import { ASSIGNABLE_ROLES, roleLabel } from "@/lib/roles"
import type { AppRole, InvitationStatus } from "@/types/database.types"

const schema = z
  .object({
    email: z.string().min(1, "Ingresa un correo").email("Correo inválido"),
    fullName: z.string().optional(),
    // Derivado de ASSIGNABLE_ROLES —la misma lista que llena el <Select>— y no
    // escrito a mano: cuando esto eran dos listas separadas, agregar un rol
    // dejaba el selector ofreciendo una opción que la validación rechazaba, sin
    // más pista que la etiqueta "Rol" en rojo. El cast a tupla es lo que pide
    // z.enum, que exige al menos un elemento en tiempo de tipos.
    role: z.enum(ASSIGNABLE_ROLES as [AppRole, ...AppRole[]]),
    mode: z.enum(["invitacion", "password"]),
    password: z.string().optional(),
  })
  // La contraseña solo es obligatoria en el modo de alta directa.
  .refine((v) => v.mode === "invitacion" || (v.password ?? "").length >= 8, {
    message: "Mínimo 8 caracteres",
    path: ["password"],
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
    defaultValues: {
      email: "",
      fullName: "",
      role: "analista",
      mode: "password",
      password: "",
    },
  })

  const mode = form.watch("mode")

  const onSubmit = async (values: FormValues) => {
    await inviteUser.mutateAsync({
      email: values.email,
      role: values.role,
      fullName: values.fullName,
      // En modo invitación no se manda contraseña: la persona la fija
      // siguiendo el enlace del correo.
      password: values.mode === "password" ? values.password : undefined,
    })
    form.reset()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuarios nuevos</CardTitle>
        <CardDescription>
          Crea la cuenta con una contraseña para entregarla directamente, o envía una invitación
          por correo para que la persona elija su propia contraseña.
        </CardDescription>
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
                      {ASSIGNABLE_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {roleLabel[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Método</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="password">Crear con contraseña</SelectItem>
                      <SelectItem value="invitacion">Invitar por correo</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            {mode === "password" && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="min-w-48">
                    <FormLabel>Contraseña inicial</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        autoComplete="off"
                        placeholder="Mínimo 8 caracteres"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <Button type="submit" disabled={inviteUser.isPending}>
              {mode === "password" ? <UserPlus /> : <Mail />}
              {inviteUser.isPending
                ? "Creando…"
                : mode === "password"
                  ? "Crear cuenta"
                  : "Enviar invitación"}
            </Button>
          </form>
        </Form>

        {mode === "password" && (
          <p className="text-xs text-muted-foreground">
            La cuenta queda activa de inmediato. Comparte la contraseña por un canal seguro y pide
            que la cambie en su primer ingreso desde "¿Olvidaste tu contraseña?".
          </p>
        )}

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
