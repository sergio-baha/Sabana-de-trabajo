import type { RenderEditCellProps } from "react-data-grid"
import type { GridRow } from "@/features/grid/lib/gridRows"

// Editor de celda: las filas de la grilla se derivan directo del cache de
// TanStack Query (ver DistribucionPage), así que este editor solo necesita
// confirmar el valor al perder foco o con Enter — onRowsChange dispara el
// autoguardado optimista, que recalcula Total/Diferencia al instante.
export default function HoursEditCell({
  row,
  column,
  onRowChange,
  onClose,
}: RenderEditCellProps<GridRow>) {
  const projectId = column.key
  const current = row.hours[projectId] ?? 0

  const commit = (raw: string) => {
    const parsed = raw.trim() === "" ? 0 : Number(raw)
    const safe = Number.isFinite(parsed) && parsed >= 0 ? parsed : current
    onRowChange({ ...row, hours: { ...row.hours, [projectId]: safe } }, true)
  }

  return (
    <input
      className="h-full w-full border-0 bg-transparent px-2 text-right outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      type="number"
      min={0}
      step="0.5"
      autoFocus
      defaultValue={current}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit((e.target as HTMLInputElement).value)
        } else if (e.key === "Escape") {
          onClose(false)
        }
      }}
    />
  )
}
