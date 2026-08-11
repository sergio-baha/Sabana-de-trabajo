import { Bell, CheckCheck, CornerUpLeft, Inbox, ClipboardCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/features/notifications/hooks/useNotifications"
import type { NotificationKind } from "@/features/notifications/api/notificationsApi"

const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  revision_pendiente: ClipboardCheck,
  tarea_aprobada: CheckCheck,
  tarea_devuelta: CornerUpLeft,
}

const KIND_TONE: Record<NotificationKind, string> = {
  revision_pendiente: "bg-accent text-accent-foreground",
  tarea_aprobada: "bg-success-muted text-success",
  tarea_devuelta: "bg-warning-muted text-warning",
}

function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return "ahora"
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  return `hace ${Math.round(hours / 24)} d`
}

// Buzón de avisos del circuito de revisión. Solo dentro de la plataforma —
// sin correo, por decisión del equipo.
export default function NotificationBell() {
  const { notifications, unreadCount } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : "Notificaciones"
          }
        >
          <Bell />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className="absolute top-1 right-1 grid min-w-4 place-content-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-88 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Notificaciones</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
            >
              Marcar todas como leídas
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Inbox className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">Sin novedades</p>
            <p className="text-xs text-muted-foreground">
              Acá llegan las tareas entregadas que te toca revisar, y el resultado de las
              que tú entregaste.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-80">
            <ul className="flex flex-col">
              {notifications.map((n) => {
                const kind = n.kind as NotificationKind
                const Icon = KIND_ICON[kind] ?? Bell
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => !n.read_at && markRead.mutate(n.id)}
                      className={cn(
                        "flex w-full items-start gap-2.5 border-b border-border px-3 py-2.5 text-left transition hover:bg-muted",
                        !n.read_at && "bg-primary/5"
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 grid size-7 shrink-0 place-content-center rounded-lg",
                          KIND_TONE[kind] ?? "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm leading-snug font-medium">{n.title}</span>
                        {n.body && (
                          <span className="text-xs text-muted-foreground">{n.body}</span>
                        )}
                        <span className="mt-0.5 text-[11px] text-muted-foreground">
                          {timeAgo(n.created_at)}
                        </span>
                      </span>
                      {!n.read_at && (
                        <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  )
}
