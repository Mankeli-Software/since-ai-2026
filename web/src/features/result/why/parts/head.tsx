import { headBlurb, headName } from '../../specLabel'
import { HeadRangeScale } from '../charts/HeadRangeScale'
import { NOT_EXPLAINED, closeCallOf, fmt, forgeLink, num, provenanceOf, shortHead, type PartContent, type PartCtx, type Stat } from './content'

/** Design copy (V3-R2-Head), used only in the fixture preview. */
const EXAMPLE = {
  provenance: { kind: 'measured', text: 'From your strike pattern and what you want' } as const,
  reason: 'You asked for higher, softer shots with some shape. The 201T gives you that and still forgives the thin ones you hit now and then.',
  stats: [
    { label: 'Peak height', value: '27 m', accent: true },
    { label: 'Lands at', value: '47°' },
    { label: 'Side spread', value: '±9 m' },
    { label: 'Fit score', value: '84' },
  ],
  aside: 'Two heads were close. I picked the 201T because you want the ball higher and to land soft. The 201 is 3 m longer but flatter.',
  line2: 'Thin topline',
}

export function headContent(ctx: PartCtx): PartContent {
  const { best, item, data, example } = ctx
  const name = headName(best.head)
  const cc = closeCallOf(ctx, 'head')
  const altSlug = (typeof cc?.alt === 'string' ? cc.alt : null) ?? (data.runnerUp && data.runnerUp.head !== best.head ? data.runnerUp.head : null)
  const alt = altSlug ? shortHead(headName(altSlug)) : null

  const stats: Stat[] = []
  if (!example) {
    const row = data.compare?.heads.find((h) => h.head === best.head)
    if (row) {
      stats.push({ label: 'Peak height', value: `${fmt(row.apex, 0)} m`, accent: true })
      stats.push({ label: 'Lands at', value: `${fmt(row.land_angle, 0)}°` })
      stats.push({ label: 'Side spread', value: `±${fmt(row.side_sd, 0)} m` })
    }
    const score = num(item, 'head_score') ?? row?.score_total ?? null
    if (score != null) stats.push({ label: 'Fit score', value: fmt(score, 0) })
  }

  // Aside: the close-call trade-off from the close_call block (tool copy), else a plain line.
  const closeBlock = data.latest('close_call')
  const tradeoff = closeBlock?.part === 'head' ? closeBlock.tradeoff : null
  const message = example
    ? EXAMPLE.aside
    : cc && tradeoff
      ? `Two heads were close, and I picked the ${shortHead(name)}. ${tradeoff}`
      : cc && alt
        ? `Two heads were close: the ${shortHead(name)} and the ${alt}. I picked the ${shortHead(name)}.`
        : `The ${name} came out on top for you. Ask me about any of the other heads.`

  return {
    part: 'head',
    label: 'Head',
    listValue: name,
    title: name,
    provenance: example ? EXAMPLE.provenance : provenanceOf(item?.sources),
    reason: example ? EXAMPLE.reason : (item?.plain ?? NOT_EXPLAINED),
    chart: <HeadRangeScale best={best.head} />,
    stats: example ? EXAMPLE.stats : stats,
    callout: null,
    actions: alt ? [{ label: `Compare with the ${alt}`, variant: 'lightOnDark', view: 'compare' }] : [{ label: 'Compare heads', variant: 'lightOnDark', view: 'compare' }],
    forge: forgeLink('head_choice', 'cavity back or blade?'),
    stage: {
      focus: 'headFace',
      highlight: 'head',
      label: 'head',
      lines: [name, best.head === '201t-mkii' ? EXAMPLE.line2 : headBlurb(best.head)],
      at: 22,
      caption: 'Shaft and grip dimmed.',
      drag: true,
    },
    aside: {
      message,
      chips: [alt ? `Why not the ${alt}?` : 'Why this head?', best.head.startsWith('301') ? 'Show me the 201T' : 'Show me the 301'],
    },
    next: { label: 'Shaft', to: { view: 'why', part: 'shaft' } },
  }
}
