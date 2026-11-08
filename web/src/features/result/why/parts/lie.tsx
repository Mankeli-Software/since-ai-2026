import { LieSoleDiagrams } from '../charts/LieSoleDiagrams'
import { NOT_EXPLAINED, basedOn, forgeLink, provenanceOf, type PartContent, type PartCtx, type Stat } from './content'

/** Design copy (V3-R2-Lie), used only in the fixture preview. */
const EXAMPLE = {
  provenance: { kind: 'chart', text: 'From a fitting chart, no strike data yet' } as const,
  reason:
    'Your height and wrist to floor point to a standard lie. Your shots start fairly straight, which agrees, but this is the least measured part of your fit.',
  stats: [
    { label: 'Lie', value: '0°', accent: true },
    { label: 'Start line', value: 'Straight' },
    { label: 'Based on', value: 'Chart' },
  ],
}

/** The ball-line steps, condensed from fixtures/diagrams.json `ball_line_test`. */
const BALL_LINE = 'Draw a line on a ball, hit 3 to 5 shots off a mat and read the marks on the face.'

const lieTitle = (deg: number) => (deg === 0 ? 'Standard 0°' : `${Math.abs(deg)}° ${deg > 0 ? 'upright' : 'flat'}`)

export function lieContent(ctx: PartCtx): PartContent {
  const { best, item, example } = ctx
  const lie = best.lie_deg
  const provenance = example ? EXAMPLE.provenance : provenanceOf(item?.sources)
  const fromChart = provenance?.kind !== 'measured' && provenance?.kind !== 'mixed'

  const stats: Stat[] = []
  if (!example) {
    stats.push({ label: 'Lie', value: `${lie > 0 ? '+' : ''}${lie}°`, accent: true })
    const based = basedOn(item?.sources)
    if (based) stats.push({ label: 'Based on', value: based })
  }

  return {
    part: 'lie',
    label: 'Lie',
    listValue: lie === 0 ? '0°' : `${lie > 0 ? '+' : ''}${lie}°`,
    title: lieTitle(lie),
    provenance,
    reason: example ? EXAMPLE.reason : (item?.plain ?? NOT_EXPLAINED),
    chart: <LieSoleDiagrams lie={lie} />,
    stats: example ? EXAMPLE.stats : stats,
    callout: fromChart
      ? {
          title: 'Want to be sure?',
          body: BALL_LINE,
          tone: 'tint',
          action: { label: 'Do the ball-line test', say: 'I want to do the ball-line test' },
        }
      : null,
    actions: [],
    forge: forgeLink('lie_angle', 'why lie angle matters'),
    stage: {
      focus: 'addressDTL',
      highlight: 'head',
      label: 'lie',
      lines: [lie === 0 ? 'Standard' : lieTitle(lie), lie === 0 ? 'Sole flat' : lie > 0 ? 'Toe up' : 'Toe down'],
      at: 27,
      caption: 'Club at address, seen from the front.',
      drag: true,
    },
    aside: {
      message: fromChart
        ? "Lie is from the chart, not your shots. If you want, the ball-line test checks it at home with a marker and a mat."
        : 'Your shots back up this lie.',
      chips: fromChart ? ['What does lie change?', 'How do I do the test?'] : ['What does lie change?'],
    },
    next: { label: 'Grip', to: { view: 'why', part: 'grip' } },
  }
}
