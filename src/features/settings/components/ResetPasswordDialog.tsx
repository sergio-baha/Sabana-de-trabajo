import { useEffect, useState } from "react"
import { KeyRound, RefreshCw } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useResetUserPassword } from "@/features/settings/hooks/useUsersQueries"

interface ResetPasswordDialogProps {
  /** Cuenta a reiniciar, o null con el diálogo cerrado. */
  user: { id: string; full_name: string; email: string } | null
  onOpenChange: (open: boolean) => void
}

// Genera algo pronunciable y suficientemente largo para entregar en mano. No
// pretende ser una contraseña definitiva: es la que la persona usa para
// entrar y cambiar por la suya.
function suggestPassword() {
  const palabras = ["Sabana", "Trabajo", "Equipo", "Proyecto", "Agenda", "Reporte"]
  const palabra = palabras[Math.floor(Math.random() * palabras.length)]
  const numero = Math.floor(1000 + Math.random() * 9000)
  return `${palabra}${numero}`
}

// Reiniciar la contraseña de otra persona. El administrador la fija y la
// entrega; no hay correo de por medio, que es como trabaja este equipo (el
// alta de usuarios ya tiene el mismo modo "con contraseña" en invite-user).
export default function ResetPasswordDialog({ user, onOpenChange }: ResetPasswordDialogProps) {
  const resetPassword = useResetUserPassword()
  const [password, setPassword] = useState("")

  useEffect(() => {
    if (user) setPassword(suggestPassword())
  }, [user])

  if (!user) return null

  const tooShort = password.trim().length < 8

  const handleReset = async () => {
    if (tooShort) return
    await resetPassword.mutateAsync({ id: user.id, password: password.trim() })
    onOpenChange(false)
  }

  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reiniciar contraseña</DialogTitle>
          <DialogDescription>
            Le fijas una contraseña nueva a <strong>{user.full_name}</strong> ({user.email}) y se
            la entregas. Sus sesiones abiertas se cierran, así que tendrá que entrar con esta.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="new-password">Contraseña nueva</Label>
          <div className="flex items-center gap-2">
            <Input
              id="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              // Visible a propósito: el administrador tiene que poder leerla
              // para dictarla. Ocultarla obligaría a copiar a ciegas.
              autoComplete="off"
              spellCheck={false}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Sugerir otra contraseña"
              onClick={() => setPassword(suggestPassword())}
            >
              <RefreshCw />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Mínimo 8 caracteres. Pídele que la cambie desde su perfil al entrar.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleReset} disabled={tooShort || resetPassword.isPending}>
            <KeyRound /> {resetPassword.isPending ? "Reiniciando…" : "Reiniciar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
