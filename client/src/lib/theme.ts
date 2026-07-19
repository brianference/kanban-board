const KEY = 'kb-theme'

export type Theme = 'light' | 'dark'

/**
 * Read stored theme. First visit defaults to light (ignore OS preference).
 */
export function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* ignore */
  }
  return 'light'
}

/**
 * Apply theme to document root and persist.
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* ignore */
  }
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#071018' : '#0284c7')
  }
}
