import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Stat tile. Light (C5): 12/14 pad, r10, #FFF, border #E4E4E4, label 11px #555, value BC 700 28px.
 * Dark (R1–R3): 10/14 pad, r12, #121212, border #262626, label 11px #8F8F8F, value BC 700 22px.
 * With `compare`, the value is "yours" (#C24F00 light / #FF8A33 dark) followed by "vs X" in grey 16px.
 */
export interface StatTileProps {
  label: string
  value: ReactNode
  /** Small unit after the value, e.g. "m" (rendered at 16px grey). Optional: the value can include it. */
  unit?: string
  /** The other option's value, shown as "vs {compare}". */
  compare?: ReactNode
  tone?: 'light' | 'dark'
  className?: string
}

export function StatTile({ label, value, unit, compare, tone = 'light', className }: StatTileProps) {
  const dark = tone === 'dark'
  return (
    <div
      className={cn(
        'min-w-0 border',
        dark ? 'rounded-12 border-grey-26 bg-grey-12 px-3.5 py-2.5 text-washed-white' : 'rounded-10 border-grey-e4 bg-white px-3.5 py-3 text-midnight',
        className,
      )}
    >
      <span className={cn('block font-display text-[11px] font-semibold uppercase tracking-[0.16em]', dark ? 'text-grey-8f' : 'text-grey-55')}>
        {label}
      </span>
      <div className={cn('font-display font-bold tabular-nums', dark ? 'text-[22px]' : 'text-[28px]')}>
        <span className={cn(compare !== undefined && (dark ? 'text-orange-hover' : 'text-orange-text'))}>{value}</span>
        {unit && compare === undefined && <span className={cn('text-[16px]', dark ? 'text-grey-8f' : 'text-grey-55')}> {unit}</span>}
        {compare !== undefined && (
          <span className={cn('text-[16px]', dark ? 'text-grey-8f' : 'text-grey-55')}>
            {' '}
            vs {compare}
            {unit ? ` ${unit}` : ''}
          </span>
        )}
      </div>
    </div>
  )
}
