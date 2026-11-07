import { cn } from '@/lib/utils'

/** "Step N of 4" + bars 24x4 r2 (orange up to N, #3D3D3D rest). Built for the dark header. */
export interface StepBarsProps {
  step: number
  total?: number
  className?: string
}

export function StepBars({ step, total = 4, className }: StepBarsProps) {
  const n = Math.max(0, Math.min(total, step))
  return (
    <span className={cn('inline-flex flex-none items-center gap-2.5', className)}>
      <span className="font-display text-[13px] font-semibold uppercase tracking-[0.16em] text-on-page-2">
        Step {n} of {total}
      </span>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn('h-1 w-6 rounded-[2px] transition-ui', i < n ? 'bg-tiger-orange' : 'bg-page-line-2')}
        />
      ))}
    </span>
  )
}
