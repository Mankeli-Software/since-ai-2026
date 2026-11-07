import { cn } from '@/lib/utils'

/** Label text of a v3 input card: Barlow 600 18px (C3b "7-iron carry", C6a "Your height"). */
export const cardLabelCls = 'text-[18px] font-semibold leading-snug text-midnight'

/** Big BC 800 number with a half-size grey unit (C3b 88px, C6a 96px). */
export function BigNumber({ value, unit, size = 88 }: { value: string | number; unit?: string; size?: 88 | 96 }) {
  return (
    <span
      aria-live="polite"
      className={cn('font-display font-extrabold leading-[.9] tabular-nums', size === 96 ? 'text-[96px]' : 'text-[88px]')}
    >
      {value}
      {unit && <span className="text-[36px] text-grey-55"> {unit}</span>}
    </span>
  )
}

/**
 * Compact read-only state of an answered (or superseded) input card: the question and what was sent.
 */
export function Answered({ prompt, answer }: { prompt: string; answer?: { displayText: string } }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <p className="m-0 text-[16px] font-medium text-grey-44">{prompt}</p>
      {answer ? (
        <span className="inline-flex h-[34px] items-center rounded-full border border-grey-d9 bg-white px-3.5 text-[15px] font-semibold text-midnight">
          {answer.displayText}
        </span>
      ) : (
        <span className="text-[14px] text-grey-6b">Not answered</span>
      )}
    </div>
  )
}
