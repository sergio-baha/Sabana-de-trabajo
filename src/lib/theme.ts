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

export const applyTheme = (theme: Theme) => {
  document.documentElement.classList.toggle("dark", theme === "dark")
  safeSet(THEME_KEY, theme)
}

export const initTheme = () => {
  applyTheme(getSavedTheme())
}
