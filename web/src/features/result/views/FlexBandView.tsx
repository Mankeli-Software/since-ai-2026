import type { UIBlock } from '@/api/client'
import { Eyebrow } from '@/components/studio'
import { cn } from '@/lib/utils'

type FlexBandBlock = Extract<UIBlock, { type: 'flex_band' }>
type Band = FlexBandBlock['band']

export interface FlexBandViewProps {
  /** 7-iron club speed; null = not measured (no "you" marker). */
  measured_mph: number | null
  band: Band
  /** Where a guess would have put them (dashed ghost marker). */
  ghost_mph?: number | null
  ghost_label?: string | null
  /** 'dark' = R2 results panel (#121212), 'light' = conversation card (default). */
  tone?: 'light' | 'dark'
  /** Draw the panel (bg, border, padding) around the chart. Default true. */
  framed?: boolean
  /** Panel eyebrow. Default "Flex by 7-iron club speed"; null hides it. */
  title?: string | null
  className?: string
}

const BANDS: { id: Band; name: string; range: string }[] = [
  { id: 'L', name: 'ladies', range: 'under 70' },
  { id: 'R', name: 'regular', range: '70 to 80' },
  { id: 'S', name: 'stiff', range: '80 to 90' },
  { id: 'X', name: 'extra stiff', range: 'over 90' },
]

/** Axis ticks 70 / 80 / 90 mph sit at 25 / 50 / 75 % (the band edges). Linear, clamped to the chart. */
export function mphToPercent(mph: number) {
  return Math.max(1, Math.min(99, 25 + (mph - 70) * 2.5))
}

const tones = {
  dark: {
    panel: 'rounded-16 border border-grey-26 bg-grey-12 px-[22px] py-[18px] text-washed-white',
    title: 'text-grey-a3',
    band: 'bg-grey-1f text-grey-8f',
    active: 'bg-[rgba(255,110,1,0.2)] text-orange-hover shadow-[inset_0_0_0_1.5px_#FF6E01]',
    you: 'text-orange-hover',
    ghostLine: 'border-grey-8f',
    ghostText: 'text-grey-c8',
    axis: 'text-grey-8f',
  },
  light: {
    panel: 'rounded-16 border border-grey-e4 bg-white px-[22px] py-[18px] text-midnight',
    title: 'text-grey-55',
    band: 'bg-grey-ed text-grey-8f',
    active: 'bg-orange-tint text-orange-text shadow-[inset_0_0_0_1.5px_#FF6E01]',
    you: 'text-orange-text',
    ghostLine: 'border-grey-8f',
    ghostText: 'text-grey-55',
    axis: 'text-grey-55',
  },
} as const

/** L/R/S/X flex bands by 7-iron club speed (R2 shaft, K5). Solid orange = measured, dashed grey = a guess. */
export function FlexBandView({
  measured_mph,
  band,
  ghost_mph = null,
  ghost_label = null,
  tone = 'light',
  framed = true,
  title = 'Flex by 7-iron club speed',
  className,
}: FlexBandViewProps) {
  const t = tones[tone]
  const you = measured_mph == null ? null : mphToPercent(measured_mph)
  const ghost = ghost_mph == null ? null : mphToPercent(ghost_mph)
  // Labels go away from each other: "you" on the left of its line unless it is near the left edge.
  const youLeft = you !== null && (ghost === null ? you >= 30 : ghost >= you ? you >= 30 : you > 70)
  const ghostRight = ghost !== null && (you === null ? ghost <= 70 : ghost >= you)
  const active = BANDS.find((b) => b.id === band)

  const summary = [
    `Flex bands by 7-iron club speed: ${BANDS.map((b) => `${b.id} ${b.range}`).join(', ')} mph.`,
    measured_mph != null ? `You: ${Math.round(measured_mph)} mph, measured.` : 'Club speed not measured yet.',
    active ? `Your band: ${active.name}.` : '',
    ghost_mph != null ? `${ghost_label ?? 'Your guess'}: ${Math.round(ghost_mph)} mph.` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cn('flex flex-col gap-3.5', framed && t.panel, className)}>
      {title && <Eyebrow className={t.title}>{title}</Eyebrow>}
      <div role="img" aria-label={summary} className="relative pt-11 pb-[26px]">
        <div aria-hidden="true" className="flex gap-1.5">
          {BANDS.map((b) => (
            <div
              key={b.id}
              className={cn(
                'flex h-[52px] flex-1 items-center justify-center rounded-8 font-display text-[22px] font-bold',
                b.id === band ? t.active : t.band,
              )}
            >
              {b.id}
            </div>
          ))}
        </div>

        {ghost !== null && (
          <div aria-hidden="true">
            <div
              className={cn('absolute top-3.5 bottom-5 -translate-x-1/2 border-l-2 border-dashed', t.ghostLine)}
              style={{ left: `${ghost}%` }}
            />
            {ghost_label && (
              <span
                className={cn('absolute top-2 font-display text-[15px] font-semibold whitespace-nowrap uppercase', t.ghostText)}
                style={ghostRight ? { left: `calc(${ghost}% + 10px)` } : { right: `calc(${100 - ghost}% + 10px)` }}
              >
                {ghost_label}
              </span>
            )}
          </div>
        )}

        {you !== null && measured_mph != null && (
          <div aria-hidden="true">
            <div
              className="absolute top-1.5 bottom-5 w-[3px] -translate-x-1/2 rounded-[2px] bg-tiger-orange"
              style={{ left: `${you}%` }}
            />
            <div
              className="absolute top-0 size-3 -translate-x-1/2 rounded-full bg-tiger-orange"
              style={{ left: `${you}%` }}
            />
            <span
              className={cn('absolute -top-0.5 font-display text-[17px] font-bold whitespace-nowrap', t.you)}
              style={youLeft ? { right: `calc(${100 - you}% + 12px)` } : { left: `calc(${you}% + 12px)` }}
            >
              YOU, {Math.round(measured_mph)} MPH
            </span>
          </div>
        )}

        <div aria-hidden="true" className={cn('absolute right-0 bottom-0 left-0 text-[13px] tabular-nums', t.axis)}>
          <span className="absolute left-1/4 -translate-x-1/2">70</span>
          <span className="absolute left-1/2 -translate-x-1/2">80</span>
          <span className="absolute left-3/4 -translate-x-1/2 whitespace-nowrap">90 mph</span>
        </div>
      </div>
    </div>
  )
}
