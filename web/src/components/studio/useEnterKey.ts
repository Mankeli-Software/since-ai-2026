import { useEffect, useRef } from 'react'

/**
 * Enter runs the active card's primary action (the button that shows the `EnterKbd` badge).
 * Only one input card is live at a time, so a window listener is safe while `enabled`.
 * Ignored while typing (a range slider still counts as not typing), on a focused button or link
 * (Enter clicks those natively), on repeats and with modifier keys held.
 */
export function useEnterKey(onEnter: () => void, enabled: boolean) {
  const enter = useRef(onEnter)
  useEffect(() => {
    enter.current = onEnter
  })

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      const t = e.target
      if (t instanceof Element && t.closest('input:not([type=range]), textarea, select, button, a, [contenteditable="true"]')) return
      e.preventDefault()
      enter.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
