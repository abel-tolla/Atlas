import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'atlas-theme'

// The root layout's script sets data-theme on <html> before first paint.
// The server can't see it, so it renders light and the browser corrects
// the toggle's icon right after hydration.
const read = (): Theme =>
  document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read, () => 'light' as Theme)

  const toggleTheme = useCallback(() => {
    const next: Theme = read() === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage can be blocked. The theme still applies for this visit.
    }
  }, [])

  return { theme, toggleTheme }
}
