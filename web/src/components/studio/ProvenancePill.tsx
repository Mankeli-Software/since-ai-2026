import { cn } from '@/lib/utils'

/** Where a number came from: solid orange = measured, dashed hollow = guess, grey dotted = from chart. */
export type Provenance = 'measured' | 'guess' | 'chart'

export interface ProvenancePillProps {
  kind: Provenance
  /** Light card (default) or dark stage. */
  tone?: 'light' | 'dark'
  /** 'sm' = 26px (Main board), 'md' = 28px (chat cards, default). */
  size?: 'sm' | 'md'
  /** Override the default label ("Measured" / "Your guess" / "From chart"). */
  label?: string
  className?: string
}

const labels: Record<Provenance, string> = { measured: 'Measured', guess: 'Your guess', chart: 'From chart' }

const tones: Record<'light' | 'dark', Record<Provenance, string>> = {
  light: {
    measured: 'bg-orange-tint text-orange-deep',
    guess: 'border border-dashed border-grey-8f text-grey-44',
    chart: 'bg-grey-ed text-grey-44',
  },
  dark: {
    measured: 'bg-selected-dark text-orange-hover shadow-[inset_0_0_0_1px_#FF6E01]',
    guess: 'border border-dashed border-grey-8f text-grey-c8',
    chart: 'bg-grey-26 text-grey-c8',
  },
}

export function ProvenancePill({ kind, tone = 'light', size = 'md', label, className }: ProvenancePillProps) {
  return (
    <span
      className={cn(
        'inline-flex flex-none items-center rounded-full font-display text-[13px] font-semibold uppercase tracking-[0.16em] whitespace-nowrap',
        size === 'sm' ? 'h-[26px] gap-[7px] px-2.5' : 'h-7 gap-2 px-3',
        tones[tone][kind],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-block size-2 flex-none rounded-full',
          kind === 'measured' ? 'bg-tiger-orange' : 'border-[1.5px] border-current',
          kind === 'chart' && 'border-dotted',
        )}
      />
      {label ?? labels[kind]}
    </span>
  )
}
