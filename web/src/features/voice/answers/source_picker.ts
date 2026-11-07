import { pickOption } from '../spoken'
import { orList, type AnswerModule } from './types'

export default {
  type: 'source_picker',
  ask: (b) =>
    `${b.prompt} ${orList([...b.options.slice(0, 4).map((o) => o.name), ...(b.fallback ? [b.fallback.title] : [])])}?`,
  resolve(b, said) {
    const items = [
      ...b.options.map((o) => ({ item: { id: o.id, name: o.name }, names: [o.name, o.id.replace(/_/g, ' ')] })),
      ...(b.fallback
        ? [{ item: { id: b.fallback.id, name: b.fallback.title }, names: [b.fallback.title, 'skip', 'none', 'no'] }]
        : []),
    ]
    const o = pickOption(said, items)
    return o ? { value: o.id, display: o.name } : null
  },
} satisfies AnswerModule<'source_picker'>
