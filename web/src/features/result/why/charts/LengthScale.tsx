import { cn } from '@/lib/utils'
import { ChartPanel } from './ChartPanel'

export interface LengthScaleProps {
  /** Your length, inches vs standard. */
  value: number
  /** The other side of a near-line close call (inches vs standard); the marker then sits on the line. */
  alt?: number | null
}

/** The design's steps (spec §6). Your value and the close-call alternative are added when they are not on it. */
const STEPS = [-0.5, 0, 0.25, 0.5]
const GAP = 6 // px between tiles

const stepLabel = (n: number) => (n === 0 ? 'Standard' : `${n > 0 ? '+' : '−'}${Math.abs(n)} in`)

/** Left edge of a point at `slot` tiles in (0 = left edge, 0.5 = first centre, 1 = first gap), gaps included. */
function at(slot: number, n: number) {
  const tiles = Math.floor(slot)
  const frac = slot - tiles
  // tile width w = (100% - (n-1)·GAP)/n; position = tiles·(w+GAP) + frac·w, and a boundary sits mid-gap.
  const pct = ((tiles + frac) / n) * 100
  const px = tiles * GAP - ((tiles + frac) * (n - 1) * GAP) / n
  return `calc(${pct}% + ${px}px)`
}

/** R2 length: the length steps with your marker; on a close call it sits on the line to the alternative. */
export function LengthScale({ value, alt = null }: LengthScaleProps) {
  const steps = [...new Set([...STEPS, value, ...(alt != null ? [alt] : [])])].sort((a, b) => a - b)
  const n = steps.length
  const i = steps.indexOf(value)
  const j = alt != null ? steps.indexOf(alt) : -1
  const onLine = j >= 0 && Math.abs(i - j) === 1
  // Marker: the boundary between yours and the alternative (mid-gap), else the centre of your tile.
  const left = onLine ? `calc(${at(Math.max(i, j), n)} - ${GAP / 2}px)` : at(i + 0.5, n)
  const slot = onLine ? Math.max(i, j) : i + 0.5
  const labelLeft = slot / n > 0.6

  const summary = [
    `Length steps: ${steps.map(stepLabel).join(', ')}.`,
    `Yours: ${stepLabel(value)}.`,
    onLine && alt != null ? `Right on the line to ${stepLabel(alt)}.` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <ChartPanel title="Length from your height and wrist to floor">
      <div role="img" aria-label={summary} className="relative pt-10 pb-1">
        <div aria-hidden="true" className="flex" style={{ gap: GAP }}>
          {steps.map((s) => (
            <div
              key={s}
              className={cn(
                'flex h-12 flex-1 items-center justify-center rounded-8 font-display text-[18px] font-bold whitespace-nowrap',
                s === value ? 'bg-[rgba(255,110,1,0.2)] text-orange-hover shadow-[inset_0_0_0_1.5px_#FF6E01]' : 'bg-grey-1f text-grey-8f',
              )}
            >
              {stepLabel(s)}
            </div>
          ))}
        </div>
        {/* On the line it runs through the gap; otherwise it stops at your tile so it never crosses the label. */}
        <div
          aria-hidden="true"
          className={cn('absolute top-1 w-[3px] -translate-x-1/2 rounded-[2px] bg-tiger-orange', onLine ? 'bottom-0' : 'h-[36px]')}
          style={{ left }}
        />
        <span
          aria-hidden="true"
          className="absolute top-0 font-display text-[16px] font-bold whitespace-nowrap text-orange-hover"
          style={labelLeft ? { right: `calc(100% - ${left} + 8px)` } : { left: `calc(${left} + 8px)` }}
        >
          {onLine ? 'YOU, RIGHT ON THE LINE' : 'YOU'}
        </span>
      </div>
    </ChartPanel>
  )
}
