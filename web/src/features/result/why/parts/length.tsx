import { convertProseUnits, fmtHeight, fmtLength, fmtWristToFloor } from '@/lib/units'
import { useUnitsStore } from '@/store/units'
import { LengthScale } from '../charts/LengthScale'
import { NOT_EXPLAINED, closeCallOf, fmt, forgeLink, num, provenanceOf, type PartContent, type PartCtx, type Stat } from './content'

/** Design copy (V3-R2-Length), used only in the fixture preview. */
const EXAMPLE = {
  provenance: { kind: 'measured', text: 'From your height and wrist to floor, both measured' } as const,
  reason: "You're 181 cm with an 86 cm wrist to floor. That lands right between standard and +0.25 in, so the shorter one wins: easier to control.",
  stats: [
    { label: 'Height', value: '181 cm' },
    { label: 'Wrist to floor', value: '86 cm' },
    { label: 'Gap to +0.25', value: '1 mm', accent: true },
  ],
  alt: 0.25,
  aside: "This one's a close call, so I went with standard. You keep your returns, and a quarter inch is hard to feel.",
}

/** `length_in` is a delta from standard (catalog length_options_in); an absolute length is read against 37 in. */
const toDelta = (v: number) => (Math.abs(v) <= 3 ? v : v - 37)

export function lengthContent(ctx: PartCtx): PartContent {
  const units = useUnitsStore.getState().units
  const { best, item, data, example } = ctx
  const value = toDelta(best.length_in)
  const label = fmtLength(value, units)

  // A near-line close call: the alternative length, from the item or state.per_part.
  const cc = example ? { alt: EXAMPLE.alt } : closeCallOf(ctx, 'length')
  const altRaw = typeof cc?.alt === 'number' ? cc.alt : typeof cc?.alt === 'string' ? Number.parseFloat(cc.alt) : NaN
  const alt = Number.isFinite(altRaw) ? toDelta(altRaw) : null
  const altLabel = alt != null ? fmtLength(alt, units) : null

  const stats: Stat[] = []
  if (!example) {
    const height = num(item, 'height_cm')
    const wtf = num(item, 'wrist_to_floor_cm')
    const gap = num(item, 'gap_mm')
    if (height != null) stats.push({ label: 'Height', value: fmtHeight(height, units) })
    if (wtf != null) stats.push({ label: 'Wrist to floor', value: fmtWristToFloor(wtf, units) })
    if (gap != null && altLabel) stats.push({ label: `Gap to ${altLabel}`, value: units === 'metric' ? `${fmt(gap)} mm` : `${fmt(gap / 25.4, 2)} in`, accent: true })
  } else {
    stats.push(
      { label: 'Height', value: fmtHeight(181, units) },
      { label: 'Wrist to floor', value: fmtWristToFloor(86, units) },
      { label: `Gap to ${fmtLength(0.25, units)}`, value: units === 'metric' ? '1 mm' : '0.04 in', accent: true },
    )
  }

  // "Show me +0.25 anyway" leads to R5, which exists only when a stock_vs_custom card arrived.
  const custom = example || data.latest('stock_vs_custom') != null

  return {
    part: 'length',
    label: 'Length',
    listValue: label,
    title: label,
    provenance: example ? EXAMPLE.provenance : provenanceOf(item?.sources),
    reason: example ? convertProseUnits(EXAMPLE.reason, units) : (item?.plain ? convertProseUnits(item.plain, units) : NOT_EXPLAINED),
    chart: <LengthScale value={value} alt={alt} />,
    stats,
    callout:
      altLabel != null
        ? {
            title: `Why not ${altLabel}?`,
            body: "It would make the set custom, and custom can't be returned. When you're on the line, stock with 30-day returns is the better deal.",
            tone: 'dark',
          }
        : null,
    actions: altLabel != null && custom ? [{ label: `Show me ${altLabel.replace(/ in$/, '')} anyway`, variant: 'ghostOnDark', view: 'stock' }] : [],
    forge: forgeLink('club_length', 'what length really changes'),
    stage: {
      focus: 'shaft',
      highlight: null,
      label: 'length',
      lines: [label, '7-iron'],
      at: 54,
      caption: 'Full club, measured from the sole to the end of the grip.',
      drag: false,
    },
    aside: {
      message: example
        ? EXAMPLE.aside
        : altLabel != null
          ? `This one's a close call, so I went with ${label.toLowerCase()}. You keep your returns, and the difference is hard to feel.`
          : value === 0
            ? 'Standard length fits how you stand over the ball, so there is nothing to add or take off.'
            : `${label} fits how you stand over the ball.`,
      chips: altLabel != null ? ['Will I feel the difference?', 'What if I grow into it?'] : ['What does length change?', 'What if I grow into it?'],
    },
    next: { label: 'Lie', to: { view: 'why', part: 'lie' } },
  }
}
