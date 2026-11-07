import { norm, parseNumber } from '../spoken'
import type { AnswerModule } from './types'

/** `{missing_value?}` like the card's "Show my fit". A "yes" with nothing missing confirms. */
export default {
  type: 'heard_summary',
  ask: (b) => {
    const facts = b.facts.map((f) => f.label).join(', ')
    return b.missing ? `Here's what I heard: ${facts}. ${b.missing.prompt}` : `Here's what I heard: ${facts}. Shall I show your fit?`
  },
  resolve(b, said) {
    const n = parseNumber(said)
    if (b.missing && n !== null) return { value: { missing_value: n }, display: 'Show my fit' }
    if (/\b(yes|show|right|correct|go)\b/.test(norm(said))) return { value: { missing_value: undefined }, display: 'Show my fit' }
    return null
  },
} satisfies AnswerModule<'heard_summary'>
