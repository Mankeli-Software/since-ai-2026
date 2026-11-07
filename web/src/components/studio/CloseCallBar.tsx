import { cn } from '@/lib/utils'

/**
 * Close-call split bar: label A, 10px bar (A share #FF6E01 | 2px separator | B share #C8C8C8), label B.
 * Labels BC 700 18px. `tone` sets the separator to the surface colour (light #F8F8F8, dark #121212).
 */
export interface CloseCallSide {
  label: string
  /** Share in percent (A + B need not sum to 100; the bar uses them as flex weights). */
  share: number
}

export interface CloseCallBarProps {
  a: CloseCallSide
  b: CloseCallSide
  tone?: 'light' | 'dark'
  /** Show "53%" under each label. Off by default (the mockups show only the bar). */
  showShares?: boolean
  className?: string
}

export function CloseCallBar({ a, b, tone = 'light', showShares = false, className }: CloseCallBarProps) {
  const dark = tone === 'dark'
  const label = (s: CloseCallSide, align: 'left' | 'right') => (
    <span className={cn('flex flex-none flex-col', align === 'right' && 'items-end')}>
      <span className="font-display text-[18px] font-bold">{s.label}</span>
      {showShares && (
        <span className={cn('font-display text-[13px] font-semibold tabular-nums', dark ? 'text-grey-a3' : 'text-grey-55')}>
          {Math.round(s.share)}%
        </span>
      )}
    </span>
  )
  return (
    <div
      role="img"
      aria-label={`Close call: ${a.label} ${Math.round(a.share)} percent, ${b.label} ${Math.round(b.share)} percent`}
      className={cn('flex items-center gap-2.5', dark ? 'text-washed-white' : 'text-midnight', className)}
    >
      {label(a, 'left')}
      <div aria-hidden="true" className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-3">
        <div className="bg-tiger-orange transition-ui" style={{ flexGrow: Math.max(0, a.share), flexBasis: 0 }} />
        <div className={cn('w-0.5 flex-none', dark ? 'bg-grey-12' : 'bg-washed-white')} />
        <div className="bg-grey-c8 transition-ui" style={{ flexGrow: Math.max(0, b.share), flexBasis: 0 }} />
      </div>
      {label(b, 'right')}
    </div>
  )
}
