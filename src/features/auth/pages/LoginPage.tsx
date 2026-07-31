import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router"
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
import { signInWithPassword } from "@/features/auth/api/authApi"

const schema = z.object({
  email: z.string().min(1, "Ingresa tu correo").email("Correo inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true)
    try {
      await signInWithPassword(values.email, values.password)
      const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard"
      navigate(redirectTo, { replace: true })
    } catch (error) {
      toast.error("No se pudo iniciar sesión", {
        description: error instanceof Error ? error.message : "Verifica tus credenciales.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background p-4">
      {/* Halos de marca difuminados de fondo — profundidad sin robar atención */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 size-[28rem] rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--gradient-brand)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -bottom-32 size-[26rem] rounded-full opacity-15 blur-3xl"
        style={{ background: "var(--gradient-orange)" }}
      />
      <Card className="animate-scale-in relative w-full max-w-sm shadow-brand-xl">
        <CardHeader>
          <div
            className="mb-1 flex size-11 items-center justify-center rounded-xl text-base font-bold text-white"
            style={{ background: "var(--gradient-brand)", boxShadow: "var(--sh-purple)" }}
          >
            DT
          </div>
          <CardTitle className="text-xl">Distribución de Trabajo</CardTitle>
          <CardDescription>Inicia sesión con tu cuenta corporativa.</CardDescription>
        </CardHeader>
        <CardContent>
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
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Contraseña</FormLabel>
                      <Link
                        to="/forgot-password"
                        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        ¿Olvidaste tu contraseña?
                      </Link>
                    </div>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={submitting} className="mt-2">
                {submitting ? "Ingresando…" : "Ingresar"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
