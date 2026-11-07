import { isUnsure, parseNumber } from '../spoken'
import type { AnswerModule } from './types'

const fmt = (n: number) => String(Math.round(n * 100) / 100)

/** "about one fifty, I measured it" -> `{value: 150, measured: true}`. Out of range goes to the chat. */
export default {
  type: 'slider',
  ask: (b) => b.prompt,
  resolve(b, said) {
    if (isUnsure(said)) return b.allow_unknown ? { value: null, display: 'Not sure' } : null
    const n = parseNumber(said)
    if (n === null || n < b.min || n > b.max) return null
    const value = Math.round(n / b.step) * b.step
    const text = `${fmt(value)} ${b.unit}`
    if (!b.measured_or_guessed_toggle) return { value, display: text }
    const measured = /\b(measured|trackman|launch monitor|simulator|sim|exactly)\b/i.test(said)
    return { value: { value, measured }, display: `${text} (${measured ? 'measured' : 'guess'})` }
  },
} satisfies AnswerModule<'slider'>
