import { FlexBandView } from '../../views/FlexBandView'
import { flexName, shaftModel, stifferFlex } from '../../specLabel'
import type { Spec } from '../../types'
import { NOT_EXPLAINED, fmt, forgeLink, num, provenanceOf, type PartContent, type PartCtx, type Stat } from './content'

/** Design copy (V3-R2-Why, the shaft screen), used only in the fixture preview. */
const EXAMPLE = {
  provenance: { kind: 'measured', text: 'From 24 TrackMan shots' } as const,
  reason: 'Your swing speed sits in the regular band. Stiff would launch the ball lower, and you already fly it low.',
  stats: [
    { label: 'Club speed', value: '76 mph', accent: true },
    { label: 'Carry', value: '142 m' },
    { label: 'Launch', value: '18.2°' },
    { label: 'You want', value: 'Higher' },
  ],
  band: { measured_mph: 76, band: 'R', ghost_mph: 86, ghost_label: 'Your 165 m guess' } as const,
  aside: 'Stiff was only the 165 talking. At 76 mph, regular gets the ball up and lets it land softer, which is what you asked for.',
}

/** The band the fit's flex sits in, for a chart built from the why item alone (no flex_band block). */
const BAND_OF: Partial<Record<Spec['flex'], 'L' | 'R' | 'S' | 'X'>> = { lady: 'L', regular: 'R', stiff: 'S', 'x-stiff': 'X' }

export function shaftContent(ctx: PartCtx): PartContent {
  const { best, item, data, example } = ctx
  const flex = flexName(best.flex)
  const stiffer = stifferFlex(best.flex)
  const stifferName = stiffer ? flexName(stiffer) : null

  const block = data.latest('flex_band')
  const speed = block?.measured_mph ?? num(item, 'speed_mph', 'club_speed_mph')
  const band = block ?? (example ? EXAMPLE.band : null) ?? (speed != null && BAND_OF[best.flex] ? { measured_mph: speed, band: BAND_OF[best.flex]!, ghost_mph: null, ghost_label: null } : null)

  // The ghost's label, short enough for the narrow column: "Your 165 m guess" from the claimed carry.
  const claimed = num(item, 'claimed_carry_m')
  const ghostLabel = example ? EXAMPLE.band.ghost_label : claimed != null ? `Your ${fmt(claimed, 0)} m guess` : (band?.ghost_label ?? null)

  const stats: Stat[] = []
  if (!example) {
    if (speed != null) stats.push({ label: 'Club speed', value: `${fmt(speed, 0)} mph`, accent: true })
    const carryM = num(item, 'carry_m', 'measured_carry_m')
    const carryYd = num(item, 'carry_yd', 'measured_carry_yd')
    if (carryM != null) stats.push({ label: 'Carry', value: `${fmt(carryM, 0)} m` })
    else if (carryYd != null) stats.push({ label: 'Carry', value: `${fmt(carryYd, 0)} yd` })
    const launch = num(item, 'launch_deg')
    if (launch != null) stats.push({ label: 'Launch', value: `${fmt(launch)}°` })
    const guessM = num(item, 'claimed_carry_m')
    const guessYd = num(item, 'claimed_carry_yd')
    if (guessM != null) stats.push({ label: 'Your guess', value: `${fmt(guessM, 0)} m` })
    else if (guessYd != null) stats.push({ label: 'Your guess', value: `${fmt(guessYd, 0)} yd` })
  }

  const message = example
    ? EXAMPLE.aside
    : stifferName && claimed != null && speed != null
      ? `${stifferName} was only the ${fmt(claimed, 0)} talking. At ${fmt(speed, 0)} mph, ${flex.toLowerCase()} gets the ball up and lets it land softer.`
      : speed != null
        ? `At ${fmt(speed, 0)} mph, your swing sits in the ${flex.toLowerCase()} band.`
        : `${flex} flex fits how you swing. Ask me what a different flex would do.`

  return {
    part: 'shaft',
    label: 'Shaft',
    listValue: flex,
    title: `${shaftModel(best)}, ${flex}`,
    provenance: example ? EXAMPLE.provenance : provenanceOf(item?.sources),
    reason: example ? EXAMPLE.reason : (item?.plain ?? NOT_EXPLAINED),
    chart: band ? <FlexBandView tone="dark" measured_mph={band.measured_mph} band={band.band} ghost_mph={band.ghost_mph} ghost_label={ghostLabel} /> : null,
    stats: example ? EXAMPLE.stats : stats,
    callout: null,
    actions: [
      {
        label: stifferName ? `See ${flex.toLowerCase()} vs ${stifferName.toLowerCase()} fly` : 'See it fly',
        variant: 'lightOnDark',
        view: 'compare',
      },
    ],
    forge: forgeLink('shaft_flex', 'what flex really changes'),
    stage: {
      focus: 'shaft',
      highlight: 'shaft',
      label: 'shaft',
      lines: [flex, shaftModel(best)],
      at: 59,
      caption: 'Rest of the club dimmed.',
      drag: true,
    },
    aside: {
      message,
      chips: stifferName ? [`What would ${stifferName.toLowerCase()} do?`, `Is ${flex.toLowerCase()} less accurate?`] : [`Is ${flex.toLowerCase()} right for me?`],
    },
    next: { label: 'Length', to: { view: 'why', part: 'length' } },
  }
}
