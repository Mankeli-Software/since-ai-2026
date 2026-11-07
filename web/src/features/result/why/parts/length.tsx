import { LengthScale } from '../charts/LengthScale'
import { NOT_EXPLAINED, closeCallOf, fmt, forgeLink, num, provenanceOf, signedIn, type PartContent, type PartCtx, type Stat } from './content'

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
const lengthLabel = (d: number) => (d === 0 ? 'Standard' : signedIn(d))

export function lengthContent(ctx: PartCtx): PartContent {
  const { best, item, data, example } = ctx
  const value = toDelta(best.length_in)
  const label = lengthLabel(value)

  // A near-line close call: the alternative length, from the item or state.per_part.
  const cc = example ? { alt: EXAMPLE.alt } : closeCallOf(ctx, 'length')
  const altRaw = typeof cc?.alt === 'number' ? cc.alt : typeof cc?.alt === 'string' ? Number.parseFloat(cc.alt) : NaN
  const alt = Number.isFinite(altRaw) ? toDelta(altRaw) : null
  const altLabel = alt != null ? lengthLabel(alt) : null

  const stats: Stat[] = []
  if (!example) {
    const height = num(item, 'height_cm')
    const wtf = num(item, 'wrist_to_floor_cm')
    const gap = num(item, 'gap_mm')
    if (height != null) stats.push({ label: 'Height', value: `${fmt(height, 0)} cm` })
    if (wtf != null) stats.push({ label: 'Wrist to floor', value: `${fmt(wtf, 0)} cm` })
    if (gap != null && altLabel) stats.push({ label: `Gap to ${altLabel.replace(/ in$/, '')}`, value: `${fmt(gap)} mm`, accent: true })
  }

  // "Show me +0.25 anyway" leads to R5, which exists only when a stock_vs_custom card arrived.
  const custom = example || data.latest('stock_vs_custom') != null

  return {
    part: 'length',
    label: 'Length',
    listValue: label,
    title: label,
    provenance: example ? EXAMPLE.provenance : provenanceOf(item?.sources),
    reason: example ? EXAMPLE.reason : (item?.plain ?? NOT_EXPLAINED),
    chart: <LengthScale value={value} alt={alt} />,
    stats: example ? EXAMPLE.stats : stats,
    callout:
      altLabel != null
        ? {
            title: `Why not ${altLabel.replace(/ in$/, '')}?`,
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
