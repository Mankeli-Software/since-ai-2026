import { DEFAULT_GLOVES, GRIP_BY_GLOVE, GloveGripMap } from '../charts/GloveGripMap'
import { NOT_EXPLAINED, fmt, forgeLink, num, provenanceOf, type PartContent, type PartCtx, type Stat } from './content'

const GRIP_NAMES = { standard: 'Standard', midsize: 'Midsize', oversize: 'Oversize' } as const

/**
 * Design copy (V3-R2-Grip), used only in the fixture preview, reworded to match the catalog: the mockup's
 * "a large glove fits a standard grip" is not what the glove -> grip table says (L is midsize), so the
 * preview names no glove and keeps the preview spec's standard grip.
 */
const EXAMPLE = {
  provenance: { kind: 'measured', text: 'From your glove size, measured' } as const,
  reason: "Your glove size fits a standard grip. Nothing hurts when you play, so there's no reason to go bigger.",
  stats: [
    { label: 'Grip', value: 'Standard', accent: true },
    { label: 'Anything hurts', value: 'Nothing' },
  ],
}

const article = (label: string) => (/^[aeiouAEIOU]|^(L|M|ML|S|XL|XS)$/.test(label) ? 'an' : 'a')

export function gripContent(ctx: PartCtx): PartContent {
  const { best, item, example, glove } = ctx
  const grip = best.grip
  const name = GRIP_NAMES[grip]
  // The golfer's glove only when it agrees with the fit's grip (a typed or changed answer may not).
  const yours = !example && glove && GRIP_BY_GLOVE[glove.id] === grip ? glove : null
  const gloves = yours?.options.length ? yours.options : DEFAULT_GLOVES
  const gloveLabel = yours ? (gloves.find((g) => g.id === yours.id)?.label ?? yours.id) : null

  const stats: Stat[] = []
  if (!example) {
    if (gloveLabel) stats.push({ label: 'Glove', value: gloveLabel, accent: true })
    stats.push({ label: 'Grip', value: name, accent: !gloveLabel })
    const hand = num(item, 'hand_length_cm')
    if (hand != null) stats.push({ label: 'Hand length', value: `${fmt(hand)} cm` })
  }

  const other = grip === 'standard' ? 'midsize' : 'standard'
  const message = example
    ? 'Standard grip for your glove size. If your hands ever ache, a midsize takes pressure off. Tell me and I\'ll swap it.'
    : gloveLabel
      ? `${name} grip for ${article(gloveLabel)} ${gloveLabel} glove. If it ever feels too thick or too thin, tell me and I'll swap it.`
      : `${name} grip for your hands. If it ever feels too thick or too thin, tell me and I'll swap it.`

  return {
    part: 'grip',
    label: 'Grip',
    listValue: name,
    title: grip === 'standard' ? 'Standard size' : name,
    provenance: example ? EXAMPLE.provenance : provenanceOf(item?.sources),
    reason: example ? EXAMPLE.reason : (item?.plain ?? NOT_EXPLAINED),
    chart: <GloveGripMap gloves={gloves} yours={yours?.id ?? null} grip={grip} />,
    stats: example ? EXAMPLE.stats : stats,
    callout: null,
    actions: [],
    forge: forgeLink('grip_size', 'grip size and your hands'),
    stage: {
      focus: 'grip',
      highlight: 'grip',
      label: 'grip',
      lines: [name, 'Lamkin'],
      at: 75,
      caption: 'Head and shaft dimmed.',
      drag: true,
    },
    aside: { message, chips: [`What about ${other}?`, 'Can I pick the colour?'] },
    next: { label: 'Compare heads', to: { view: 'compare' } },
  }
}
