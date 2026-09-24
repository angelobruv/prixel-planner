import { useEffect, useState } from 'react'

/** 'auto' follows the OS. The stylesheet does the work; this only stamps
 *  data-theme on <html> when the user has pinned one. index.html applies the
 *  same stamp before first paint, so a pinned dark theme never flashes light. */
export type Theme = 'auto' | 'light' | 'dark'
export const THEME_KEY = 'prixel-planner-theme'
const ORDER: Theme[] = ['auto', 'light', 'dark']
export const THEME_LABEL: Record<Theme, string> = { auto: 'Auto', light: 'Light', dark: 'Dark' }

function stored(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch { return 'auto' }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(stored)
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = theme
    try {
      if (theme === 'auto') localStorage.removeItem(THEME_KEY)
      else localStorage.setItem(THEME_KEY, theme)
    } catch { /* private window: the choice lasts until reload */ }
  }, [theme])
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]
  return { theme, next, cycle: () => setTheme(next) }
}
