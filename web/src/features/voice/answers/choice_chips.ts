import { isUnsure, norm, pickOption } from '../spoken'
import { orList, type AnswerModule } from './types'

/** Same values as tapping: option id (or ids for `multi`), null for "Not sure". */
export default {
  type: 'choice_chips',
  ask: (b) => (b.options.length <= 4 ? `${b.prompt} ${orList(b.options.map((o) => o.label))}?` : b.prompt),
  resolve(b, said) {
    if (isUnsure(said)) return { value: null, display: 'Not sure' }
    const opts = b.options.map((o) => ({ item: o, names: [o.label, o.id.replace(/_/g, ' ')] }))
    if (b.multi) {
      // Every option named in the sentence ("accuracy and height").
      const n = norm(said)
      const picked = b.options.filter((o) => n.includes(norm(o.label)))
      const ids = (picked.length ? picked : [pickOption(said, opts)].filter((o) => o !== null)).map((o) => o.id)
      const capped = b.field === 'characteristics' ? ids.slice(0, 3) : ids
      if (!capped.length) return null
      return { value: capped, display: capped.map((id) => b.options.find((o) => o.id === id)?.label ?? id).join(', ') }
    }
    const o = pickOption(said, opts)
    if (o) return { value: o.id, display: o.label }
    // Free text is a real answer when the card asks for it.
    return b.allow_free_text ? { value: said, display: said } : null
  },
} satisfies AnswerModule<'choice_chips'>
