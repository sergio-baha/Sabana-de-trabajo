import type { RecentChange } from "@/features/dashboard/api/dashboardApi"
import { actionLabel, fieldLabel, tableLabel } from "@/features/history/lib/auditLabels"
import { useProfiles } from "@/hooks/useProfiles"

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function RecentChangesList({ changes }: { changes: RecentChange[] }) {
  const { byId: profilesById } = useProfiles()

  if (changes.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay cambios registrados.</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {changes.map((change) => {
        const author = change.changed_by ? profilesById.get(change.changed_by) : undefined
        return (
          <li key={change.id} className="flex items-start justify-between gap-3 text-sm">
            <div>
              <span className="font-medium">{author?.full_name ?? "Alguien"}</span>{" "}
              <span className="text-muted-foreground">
                {actionLabel(change.action).toLowerCase()} {tableLabel(change.table_name).toLowerCase()}
                {change.field_name && ` · ${fieldLabel(change.field_name)}`}
              </span>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatWhen(change.changed_at)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
