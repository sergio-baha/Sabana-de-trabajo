import { create } from "zustand"

// Clave del ítem de la barra que se resalta en el paso actual. Es la ruta
// del módulo (`/tareas`), o el centinela ACCOUNT_TARGET para los pasos que
// hablan del menú del avatar — esos módulos no tienen enlace propio en la
// barra, viven dentro del desplegable de la cuenta.
export const ACCOUNT_TARGET = "__account__"

interface OnboardingState {
  open: boolean
  step: number
  /** Ruta (o ACCOUNT_TARGET) del elemento que debe brillar ahora. */
  highlight: string | null
  start: () => void
  close: () => void
  setStep: (step: number) => void
  setHighlight: (highlight: string | null) => void
}

// El recorrido vive en un store y no en props porque son dos zonas lejanas
// del árbol las que se coordinan: el panel del tour (abajo a la derecha) y
// el ítem del menú que debe brillar (dentro del Sidebar). Pasarlo por props
// obligaría a que AppShell conociera el paso actual.
export const useOnboardingStore = create<OnboardingState>((set) => ({
  open: false,
  step: 0,
  highlight: null,
  start: () => set({ open: true, step: 0 }),
  close: () => set({ open: false, highlight: null }),
  setStep: (step) => set({ step }),
  setHighlight: (highlight) => set({ highlight }),
}))
