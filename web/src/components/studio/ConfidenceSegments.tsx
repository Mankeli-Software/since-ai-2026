import { cn } from '@/lib/utils'

/**
 * Fit confidence: 10 `.seg` (10x5, gap 2), on-count = round(value / 10), plus "NN%".
 * `value` null renders every segment off and "–". Built for the dark header (text inherits colour).
 */
export interface ConfidenceSegmentsProps {
  value: number | null
  /** Show the "Fit confidence" eyebrow before the segments (default true). */
  showLabel?: boolean
  className?: string
}

export function ConfidenceSegments({ value, showLabel = true, className }: ConfidenceSegmentsProps) {
  const pct = value === null ? null : Math.max(0, Math.min(100, Math.round(value)))
  const on = pct === null ? 0 : Math.round(pct / 10)
  return (
    <span
      role="img"
      aria-label={pct === null ? 'Fit confidence not known yet' : `Fit confidence ${pct} percent`}
      className={cn('inline-flex flex-none items-center gap-2.5', className)}
    >
      {showLabel && (
        <span className="font-display text-[13px] font-semibold uppercase tracking-[0.16em] text-on-page-2">
          Fit confidence
        </span>
      )}
      <span className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={cn('h-[5px] w-2.5 rounded-[1px] transition-ui', i < on ? 'bg-tiger-orange' : 'bg-page-line-2')}
          />
        ))}
      </span>
      <span className="font-display text-[20px] font-bold tabular-nums text-on-page">{pct === null ? '–' : `${pct}%`}</span>
    </span>
  )
}
