import { useState } from "react"
import { Link } from "react-router"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requestPasswordReset } from "@/features/auth/api/authApi"

const schema = z.object({
  email: z.string().min(1, "Ingresa tu correo").email("Correo inválido"),
})

type FormValues = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  })

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true)
    try {
      await requestPasswordReset(values.email)
      setSent(true)
    } catch (error) {
      toast.error("No se pudo enviar el correo", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Recuperar contraseña</CardTitle>
          <CardDescription>
            {sent
              ? "Revisa tu correo para continuar."
              : "Te enviaremos un enlace para restablecer tu contraseña."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <Button variant="outline" asChild className="w-full">
              <Link to="/login">Volver a iniciar sesión</Link>
            </Button>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="email" placeholder="tu@empresa.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Enviando…" : "Enviar enlace"}
                </Button>
                <Button variant="link" asChild className="px-0">
                  <Link to="/login">Volver a iniciar sesión</Link>
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
