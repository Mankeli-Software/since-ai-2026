import { useEffect, useRef } from 'react'

/**
 * Number keys 1..9 pick an option in the active input card (spec: "number keys pick").
 * Only one input card is live at a time, so a window listener is safe while `enabled`.
 * Ignored while typing in an input/textarea or with modifier keys held.
 */
export function useNumberKeys(count: number, onPick: (index: number) => void, enabled: boolean) {
  const pick = useRef(onPick)
  useEffect(() => {
    pick.current = onPick
  })

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= Math.min(count, 9)) {
        e.preventDefault()
        pick.current(n - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [count, enabled])
}
