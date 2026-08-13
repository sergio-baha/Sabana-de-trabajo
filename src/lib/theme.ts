const THEME_KEY = "sabana-theme"

export type Theme = "light" | "dark"

const safeGet = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const safeSet = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* modo incógnito */
  }
}

export const getSavedTheme = (): Theme => {
  const saved = safeGet(THEME_KEY)
  if (saved === "dark" || saved === "light") return saved
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
  } catch {
    return "light"
  }
}

// El tema vive en el DOM, no en React (mismo mecanismo que Experia §15). Se
// marca de las dos formas — la clase `.dark` que usa Tailwind y el atributo
// `data-theme` del sistema de diseño — para que las reglas escritas con
// cualquiera de las dos convenciones apliquen igual.
export const applyTheme = (theme: Theme) => {
  const root = document.documentElement
  root.classList.toggle("dark", theme === "dark")
  if (theme === "dark") root.setAttribute("data-theme", "dark")
  else root.removeAttribute("data-theme")
  safeSet(THEME_KEY, theme)
}

export const initTheme = () => {
  applyTheme(getSavedTheme())
}
