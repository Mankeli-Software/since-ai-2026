import { useEffect, useRef, useState } from 'react'
import { Eyebrow } from '@/components/studio'
import { cn } from '@/lib/utils'

export interface ConfidenceUpdateViewProps {
  /** Percent before the answer. */
  before: number
  /** Percent after the answer (counts up from `before` on first mount). */
  after: number
  /** What changed, e.g. "Shaft: now measured" (orange-dot chips). */
  changes?: string[]
  /** "{n} things left that would help"; hidden when null/undefined. */
  left_count?: number | null
  /** Light card (default) or dark stage. */
  tone?: 'light' | 'dark'
  /** Count the after-number up over 600 ms on first mount. Default true; off with prefers-reduced-motion. */
  animate?: boolean
  className?: string
}

const DURATION_MS = 600
const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** The value while the first-mount count-up runs; afterwards (and when `to` changes later) it is just `to`. */
function useCountUp(from: number, to: number, enabled: boolean) {
  const start = useRef({ from, to, run: enabled && from !== to && !prefersReducedMotion() })
  const [value, setValue] = useState<number | null>(start.current.run ? from : null)

  useEffect(() => {
    const { from: a, to: b, run } = start.current
    if (!run) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / DURATION_MS)
      const eased = 1 - (1 - p) ** 3
      setValue(p < 1 ? Math.round(a + (b - a) * eased) : null)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return value ?? to
}

/** Confidence update (C5, K5): "34 → 68%", 10 segments, change chips, things left. Small and inline. */
export function ConfidenceUpdateView({
  before,
  after,
  changes = [],
  left_count,
  tone = 'light',
  animate = true,
  className,
}: ConfidenceUpdateViewProps) {
  const dark = tone === 'dark'
  const from = clampPct(before)
  const to = clampPct(after)
  const shown = useCountUp(from, to, animate)
  const on = Math.round(shown / 10)

  return (
    <div className={cn('flex flex-col gap-2.5', dark ? 'text-washed-white' : 'text-midnight', className)}>
      <Eyebrow className={dark ? 'text-grey-a3' : 'text-grey-55'}>Fit confidence</Eyebrow>
      <p className="sr-only">
        Fit confidence went from {from} to {to} percent.
      </p>
      <div aria-hidden="true" className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <span className="font-display text-[64px] leading-[0.9] font-extrabold tabular-nums">
          <span className="text-[36px] text-grey-8f">{from} →</span> {shown}%
        </span>
        <span className="flex min-w-[180px] flex-1 gap-0.5">
          {Array.from({ length: 10 }, (_, i) => (
            <span
              key={i}
              className={cn(
                'h-2 flex-1 rounded-[1px] transition-ui',
                i < on ? 'bg-tiger-orange' : dark ? 'bg-grey-1f' : 'bg-grey-c8',
              )}
            />
          ))}
        </span>
      </div>
      {changes.length > 0 && (
        <ul aria-label="What changed" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {changes.map((c) => (
            <li
              key={c}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[13px] font-semibold',
                dark ? 'border-grey-26 bg-grey-16 text-grey-c8' : 'border-grey-d9 bg-white',
              )}
            >
              <span aria-hidden="true" className="size-1.5 flex-none rounded-full bg-tiger-orange" />
              {c}
            </li>
          ))}
        </ul>
      )}
      {left_count != null && left_count > 0 && (
        <span className={cn('text-[13px]', dark ? 'text-grey-a3' : 'text-grey-55')}>
          {left_count} {left_count === 1 ? 'thing' : 'things'} left that would help
        </span>
      )}
    </div>
  )
}
