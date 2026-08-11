import { useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabaseClient"
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/api/notificationsApi"
import { useSessionStore } from "@/stores/sessionStore"

const notificationsKey = ["notifications"] as const

export function useNotifications() {
  const profileId = useSessionStore((s) => s.profile?.id)
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: notificationsKey,
    queryFn: listNotifications,
    enabled: Boolean(profileId),
  })

  // El aviso tiene que llegar sin recargar: si el gestor está mirando otra
  // pantalla, la campana debe encenderse sola. Se filtra por destinatario en
  // el servidor para no despertar a todo el equipo con cada entrega.
  useEffect(() => {
    if (!profileId) return

    const channel = supabase
      .channel(`notifications-${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${profileId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: notificationsKey })
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profileId, queryClient])

  const notifications = query.data ?? []
  const unreadCount = notifications.filter((n) => !n.read_at).length

  return { ...query, notifications, unreadCount }
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsKey }),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsKey }),
  })
}
