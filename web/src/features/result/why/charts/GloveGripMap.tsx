import { cn } from '@/lib/utils'
import type { GloveOption } from '../parts/content'
import { ChartPanel } from './ChartPanel'

type Grip = 'standard' | 'midsize' | 'oversize'

/**
 * The catalog's glove -> grip table (takomo_products.json `current_tool_rules.grip_by_glove_size`,
 * the same one the fit uses through `pack.grip_for_glove`). Ids as in the glove card ("M/L" is shown "ML").
 */
export const GRIP_BY_GLOVE: Record<string, Grip> = {
  XS: 'standard',
  S: 'standard',
  M: 'standard',
  'M/L': 'midsize',
  L: 'midsize',
  XL: 'oversize',
}

/** The glove tiles when no glove card arrived: the card's sizes, without the hand-length labels. */
export const DEFAULT_GLOVES: GloveOption[] = [
  { id: 'S', label: 'S' },
  { id: 'M', label: 'M' },
  { id: 'M/L', label: 'ML' },
  { id: 'L', label: 'L' },
  { id: 'XL', label: 'XL' },
]

const GRIP_NAMES: Record<Grip, string> = { standard: 'Standard', midsize: 'Midsize', oversize: 'Oversize' }

export interface GloveGripMapProps {
  gloves: GloveOption[]
  /** Your glove id, or null when only the grip is known (the band is still highlighted). */
  yours: string | null
  grip: Grip
}

/** R2 grip: glove size tiles over the grip bands they map to; your glove in white, your grip band in orange. */
export function GloveGripMap({ gloves, yours, grip }: GloveGripMapProps) {
  // Contiguous runs of gloves that share a grip become one band, spanning those tile columns.
  const bands: { grip: Grip; start: number; span: number }[] = []
  gloves.forEach((g, i) => {
    const b = GRIP_BY_GLOVE[g.id]
    if (!b) return
    const last = bands.at(-1)
    if (last && last.grip === b && last.start + last.span === i) last.span++
    else bands.push({ grip: b, start: i, span: 1 })
  })
  const mine = gloves.find((g) => g.id === yours)
  const summary = [
    `Glove size to grip size: ${bands.map((b) => `${gloves.slice(b.start, b.start + b.span).map((g) => g.label).join(', ')} ${GRIP_NAMES[b.grip].toLowerCase()}`).join('; ')}.`,
    mine ? `Your glove: ${mine.label}.` : '',
    `Your grip: ${GRIP_NAMES[grip].toLowerCase()}.`,
  ]
    .filter(Boolean)
    .join(' ')

  const cols = { gridTemplateColumns: `repeat(${gloves.length}, minmax(0, 1fr))` }
  return (
    <ChartPanel title="Glove size to grip size">
      <div role="img" aria-label={summary} className="flex flex-col gap-1.5">
        <div aria-hidden="true" className="grid gap-1.5" style={cols}>
          {gloves.map((g) => {
            const on = g.id === yours
            return (
              <div
                key={g.id}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-10 py-2.5',
                  on ? 'bg-washed-white text-midnight' : 'bg-grey-1f text-grey-c8',
                )}
              >
                <span className="font-display text-[22px] font-extrabold">{g.label}</span>
                {g.sub && <span className={cn('text-[11px]', on ? 'text-grey-55' : 'text-grey-8f')}>{g.sub}</span>}
              </div>
            )
          })}
        </div>
        <div aria-hidden="true" className="grid gap-1.5" style={cols}>
          {bands.map((b) => (
            <div
              key={`${b.grip}-${b.start}`}
              style={{ gridColumn: `${b.start + 1} / span ${b.span}` }}
              className={cn(
                'flex h-[34px] items-center justify-center rounded-8 text-[14px]',
                b.grip === grip
                  ? 'bg-[rgba(255,110,1,0.2)] font-bold text-orange-hover shadow-[inset_0_0_0_1.5px_#FF6E01]'
                  : 'bg-grey-1f font-semibold text-grey-8f',
              )}
            >
              {GRIP_NAMES[b.grip]}
            </div>
          ))}
        </div>
      </div>
    </ChartPanel>
  )
}
