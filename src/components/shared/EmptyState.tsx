import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

// "Sin resultados." en gris centrado era lo que tenían casi todas las
// pantallas: correcto pero mudo. Este bloque dice además qué hacer al
// respecto, y da un ancla visual cuando la tabla está vacía.
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "animate-scale-in flex flex-col items-center gap-3 px-4 py-12 text-center",
        className
      )}
    >
      <div className="empty-state-icon" aria-hidden>
        <Icon className="size-6" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        {description && (
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}
