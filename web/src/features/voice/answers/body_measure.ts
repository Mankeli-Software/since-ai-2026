import { isUnsure, norm, pickOption, wordsToDigits } from '../spoken'
import { orList, type AnswerModule } from './types'

const round1 = (n: number) => Math.round(n * 10) / 10
/** Below this a bare number is inches, not cm (the card's own ranges). */
const INCH_BELOW = { height: 0, wrist_to_floor: 50, hand_length: 12, glove: 0 } as const

/**
 * Same payloads as the card: `{field, value_cm, unit, raw}`, glove `{field, value, raw}`,
 * "not sure" `{field, value: null, unsure: true}`. Heights: "180", "1.80", "six foot two", "5'11".
 */
export default {
  type: 'body_measure',
  ask: (b) => (b.options?.length ? `${b.prompt} ${orList(b.options.map((o) => o.label))}?` : b.prompt),
  resolve(b, said) {
    if (isUnsure(said)) return { value: { field: b.field, value: null, unsure: true }, display: 'Not sure' }
    if (b.field === 'glove' || b.options?.length) {
      const o = pickOption(said, (b.options ?? []).map((o) => ({ item: o, names: [o.label, o.id] })))
      return o ? { value: { field: 'glove', value: o.id, raw: o.label }, display: `Glove ${o.label}` } : null
    }
    const t = norm(wordsToDigits(said))
    const inchesOk = (b.unit_options ?? ['cm', 'in']).includes('in')

    if (b.field === 'height') {
      const ft = /(\d)\s*(?:'|ft|foot|feet)\s*(?:and\s*)?(\d{1,2})?/.exec(t)
      if (ft && inchesOk) {
        const inches = Number(ft[1]) * 12 + Number(ft[2] ?? 0)
        if (inches < 48 || inches > 90) return null
        return {
          value: { field: b.field, value_cm: round1(inches * 2.54), unit: 'in', raw: inches },
          display: `${Math.floor(inches / 12)} ft ${inches % 12} in`,
        }
      }
      const m = /(\d+(?:\.\d+)?)/.exec(t)
      if (!m) return null
      let cm = Number(m[1])
      if (cm > 1.2 && cm < 2.3) cm *= 100 // "1.83 metres"
      cm = Math.round(cm)
      if (cm < 120 || cm > 230) return null
      return { value: { field: b.field, value_cm: cm, unit: 'cm', raw: cm }, display: `${cm} cm` }
    }

    const m = /(\d+(?:\.\d+)?)/.exec(t)
    if (!m) return null
    const n = Number(m[1])
    const saysIn = /\b(inch|inches|in)\b|"/.test(t)
    const saysCm = /\b(cm|centimet\w*|senttia)\b/.test(t)
    const unit = inchesOk && (saysIn || (!saysCm && n < INCH_BELOW[b.field])) ? 'in' : 'cm'
    const cm = unit === 'in' ? n * 2.54 : n
    if (cm <= 0 || cm > 150) return null
    return { value: { field: b.field, value_cm: round1(cm), unit, raw: n }, display: `${n} ${unit}` }
  },
} satisfies AnswerModule<'body_measure'>
