import type { Spec } from './types'

/** Display names, slug and spec -> the words the v3 results screens use ("201T MkII, KBS Tour Lite Regular"). */

type Head = Spec['head']
type Flex = Spec['flex']

const HEAD_NAMES: Record<Head, string> = {
  '101-mkii': '101 MkII',
  '201-mkii': '201 MkII',
  '201t-mkii': '201T MkII',
  '301-cb': '301 CB',
  '301-mb': '301 MB',
}

/** Short head blurbs, condensed from the catalog descriptions (takomo_products.json). No numbers. */
const HEAD_BLURBS: Record<Head, string> = {
  '101-mkii': 'Most forgiving, most distance',
  '201-mkii': 'Distance, forgiveness and workability',
  '201t-mkii': 'More workable, a hint of forgiveness',
  '301-cb': 'Forged, control and forgiveness',
  '301-mb': 'Forged blade, the most workable',
}

const FLEX_NAMES: Record<Flex, string> = {
  lady: 'Ladies',
  senior: 'Senior',
  regular: 'Regular',
  stiff: 'Stiff',
  'x-stiff': 'X-Stiff',
}

/** Shaft model by slug prefix (catalog shafts.csv). Longest prefix first so "kbs-tour-lite" beats "kbs-tour". */
const SHAFT_MODELS: [prefix: string, model: string][] = [
  ['kbs-c-taper-lite', 'KBS C-Taper Lite'],
  ['kbs-c-taper', 'KBS C-Taper'],
  ['kbs-tour-lite', 'KBS Tour Lite'],
  ['kbs-tour', 'KBS Tour'],
  ['mitsubishi-mmt', 'Mitsubishi MMT'],
  ['true-temper-denali-silver', 'True Temper Denali Silver'],
  ['obsidian', 'Takomo Obsidian'],
  ['fujikura-atmos-red', 'Fujikura Atmos Red'],
]

export const headName = (head: string) => HEAD_NAMES[head as Head] ?? head.replace(/-/g, ' ').toUpperCase()
export const headBlurb = (head: string) => HEAD_BLURBS[head as Head] ?? ''
export const flexName = (flex: string) => FLEX_NAMES[flex as Flex] ?? flex

/** "KBS Tour Lite" from the spec's shaft_model, else from the slug, else the slug itself. */
export function shaftModel(spec: Pick<Spec, 'shaft' | 'shaft_model'>) {
  if (spec.shaft_model) return spec.shaft_model
  const hit = SHAFT_MODELS.find(([p]) => spec.shaft === p || spec.shaft.startsWith(`${p}-`))
  return hit ? hit[1] : spec.shaft.replace(/-/g, ' ')
}

/** "KBS Tour Lite Regular". */
export const shaftLabel = (spec: Spec) => `${shaftModel(spec)} ${flexName(spec.flex)}`

const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`

/**
 * The custom part of a build, e.g. "+1° upright", "+0.5 in", "midsize grip". Empty for standard.
 * `length_in` and `lie_deg` are deltas from standard (catalog length_options_in / lie_options_deg);
 * a value outside the delta range (an absolute length) is ignored rather than guessed at.
 */
export function customDelta(spec: Spec): string[] {
  const out: string[] = []
  if (spec.lie_deg !== 0 && Math.abs(spec.lie_deg) <= 5) out.push(`${signed(spec.lie_deg)}° ${spec.lie_deg > 0 ? 'upright' : 'flat'}`)
  if (spec.length_in !== 0 && Math.abs(spec.length_in) <= 3) out.push(`${signed(spec.length_in)} in`)
  if (spec.grip !== 'standard') out.push(`${spec.grip} grip`)
  return out
}

/** Buy bar title: "201T MkII, KBS Tour Lite Regular" (+ ", +1° upright" for a custom build). */
export function specTitle(spec: Spec) {
  return [headName(spec.head), shaftLabel(spec), ...customDelta(spec)].join(', ')
}

/** The next stiffer flex, for "Why regular, not stiff?". */
export function stifferFlex(flex: Flex): Flex | null {
  const order: Flex[] = ['lady', 'senior', 'regular', 'stiff', 'x-stiff']
  const i = order.indexOf(flex)
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null
}
