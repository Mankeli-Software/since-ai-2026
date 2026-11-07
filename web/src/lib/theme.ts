import { useSyncExternalStore } from 'react'
import { hasFlag } from './flags'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'takomo-theme'

let currentTheme: Theme = 'dark'
const listeners = new Set<() => void>()

export function resolveTheme(): Theme {
  if (!hasFlag('light-mode')) return 'dark'
  if (typeof window === 'undefined') return 'dark'
  const params = new URLSearchParams(window.location.search)
  const queryTheme = params.get('theme')
  if (queryTheme === 'light' || queryTheme === 'dark') {
    return queryTheme
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') {
      return saved
    }
  } catch {
    // Ignore storage access errors
  }
  return 'dark'
}

export function applyTheme(t: Theme) {
  currentTheme = t
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = t
  }
  for (const listener of listeners) {
    listener()
  }
}

export function setTheme(t: Theme) {
  applyTheme(t)
  try {
    localStorage.setItem(STORAGE_KEY, t)
  } catch {
    // Ignore storage access errors
  }
}

export function initTheme() {
  applyTheme(resolveTheme())
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

function getSnapshot(): Theme {
  return currentTheme
}

export function useTheme(): [Theme, () => void] {
  const theme = useSyncExternalStore<Theme>(subscribe, getSnapshot, () => 'dark')
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
  }
  return [theme, toggle]
}
