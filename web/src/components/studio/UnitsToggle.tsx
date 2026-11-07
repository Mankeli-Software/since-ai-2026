import { useUnitsStore } from '@/store/units'
import { cn } from '@/lib/utils'

export interface UnitsToggleProps {
  className?: string
  size?: 'sm' | 'md'
}

export function UnitsToggle({ className, size = 'sm' }: UnitsToggleProps) {
  const { units, setUnits } = useUnitsStore()

  return (
    <div
      role="radiogroup"
      aria-label="Unit system"
      className={cn(
        'inline-flex items-center rounded-6 border border-grey-3d bg-grey-12 p-0.5 text-grey-a3',
        className,
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={units === 'imperial'}
        onClick={() => setUnits('imperial')}
        className={cn(
          'cursor-pointer rounded-4 font-display font-semibold uppercase tracking-wider transition-colors',
          size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-[12px]',
          units === 'imperial'
            ? 'bg-tiger-orange text-midnight font-bold'
            : 'text-grey-a3 hover:text-washed-white',
        )}
      >
        Imperial
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={units === 'metric'}
        onClick={() => setUnits('metric')}
        className={cn(
          'cursor-pointer rounded-4 font-display font-semibold uppercase tracking-wider transition-colors',
          size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-[12px]',
          units === 'metric'
            ? 'bg-tiger-orange text-midnight font-bold'
            : 'text-grey-a3 hover:text-washed-white',
        )}
      >
        Metric
      </button>
    </div>
  )
}
