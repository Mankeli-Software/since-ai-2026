import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * v3 range (C3b, C6a): orange fill up to the value, #C8C8C8 for the rest, orange thumb with a white ring.
 * The fill is a background gradient on the track; `accent-color` covers browsers that ignore it.
 */
export function Range({ min, max, value, className, style, ...rest }: Omit<ComponentProps<'input'>, 'type' | 'value' | 'min' | 'max'> & {
  min: number
  max: number
  value: number
}) {
  const pct = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0
  return (
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      {...rest}
      style={{ background: `linear-gradient(to right, #FF6E01 ${pct}%, #C8C8C8 ${pct}%)`, ...style }}
      className={cn(
        'm-0 h-1.5 w-full cursor-pointer appearance-none rounded-full accent-tiger-orange disabled:cursor-not-allowed disabled:opacity-60',
        '[&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-solid [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-tiger-orange [&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(0,0,0,.3)]',
        '[&::-moz-range-thumb]:size-[18px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-solid [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-tiger-orange [&::-moz-range-thumb]:shadow-[0_1px_3px_rgba(0,0,0,.3)]',
        '[&::-moz-range-track]:bg-transparent',
        className,
      )}
    />
  )
}
