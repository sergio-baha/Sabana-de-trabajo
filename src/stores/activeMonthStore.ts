import { create } from "zustand"
import { persist } from "zustand/middleware"

// El "mes activo" es contexto de trabajo global (como el workspace activo en
// Notion/Airtable): Distribución, Proyectos, Personas y Reportes operan
// sobre él en vez de llevarlo en la URL de cada módulo. Se persiste para que
// recargar la página no pierda el mes que se estaba trabajando.
interface ActiveMonthState {
  activeMonthId: string | null
  setActiveMonthId: (id: string | null) => void
}

export const useActiveMonthStore = create<ActiveMonthState>()(
  persist(
    (set) => ({
      activeMonthId: null,
      setActiveMonthId: (id) => set({ activeMonthId: id }),
    }),
    { name: "sabana-active-month" }
  )
)
