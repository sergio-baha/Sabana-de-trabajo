import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

function formatBuildTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

// Marca de agua para confirmar qué build está sirviendo Cloudflare — útil
// después de cada deploy para saber si ya tomó el commit esperado sin tener
// que ir al dashboard. __APP_COMMIT__/__APP_BUILD_TIME__ se congelan en
// build time (ver vite.config.ts), no reflejan la hora de carga de la
// página.
export default function BuildInfoBadge() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="fixed right-2 bottom-2 z-50 rounded-full border border-border bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground shadow-sm backdrop-blur-sm select-none">
          {__APP_COMMIT__} · {formatBuildTime(__APP_BUILD_TIME__)}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">
          Commit {__APP_COMMIT__} · publicado {__APP_BUILD_TIME__}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
