import { useEffect, useRef } from 'react'

/**
 * ← / → step the active input card's value (slider, height, glove size, stock vs custom); Shift = a big step.
 * Only one input card is live at a time, so a window listener is safe while `enabled`.
 * Ignored in any input (a focused range slider steps itself natively), textarea, select or editable field,
 * and with Cmd / Ctrl / Alt held. Repeats count, so holding the key keeps stepping.
 */
export function useArrowKeys(onStep: (dir: -1 | 1, big: boolean) => void, enabled: boolean) {
  const step = useRef(onStep)
  useEffect(() => {
    step.current = onStep
  })

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target
      if (t instanceof Element && t.closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      step.current(e.key === 'ArrowLeft' ? -1 : 1, e.shiftKey)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
