import { norm } from '../spoken'
import type { AnswerModule } from './types'

/** Resumes with "stock" or "custom", like the two buttons. */
export default {
  type: 'stock_vs_custom',
  ask: (b) => `${b.question} Stock or custom?`,
  resolve(_b, said) {
    const n = norm(said)
    const stock = /\b(stock|standard|returnable)\b/.test(n)
    const custom = /\b(custom|built|made to order)\b/.test(n)
    if (stock === custom) return null
    return stock ? { value: 'stock', display: 'Stock' } : { value: 'custom', display: 'Custom' }
  },
} satisfies AnswerModule<'stock_vs_custom'>
