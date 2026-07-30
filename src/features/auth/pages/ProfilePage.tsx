import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useSessionStore } from "@/stores/sessionStore"
import { roleLabel } from "@/lib/roles"

export default function ProfilePage() {
  const profile = useSessionStore((s) => s.profile)

  if (!profile) return null

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Mi perfil</CardTitle>
        <CardDescription>Información de tu cuenta.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Nombre</span>
          <span>{profile.full_name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Correo</span>
          <span>{profile.email}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Rol</span>
          <Badge variant="secondary">{roleLabel[profile.role]}</Badge>
        </div>
      </CardContent>
    </Card>
  )
}
