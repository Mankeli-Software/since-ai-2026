import { norm, pickOption } from '../spoken'
import { orList, type AnswerModule } from './types'

/** Two tiles: a plain yes / no picks the first / second tile when the titles don't say. */
export default {
  type: 'yes_no_fork',
  ask: (b) => `${b.prompt} ${orList(b.options.map((o) => o.title))}?`,
  resolve(b, said) {
    const o =
      pickOption(said, b.options.map((o) => ({ item: o, names: [o.title, o.id.replace(/_/g, ' ')] }))) ??
      (/^yes\b/.test(norm(said)) ? b.options[0] : /^no\b/.test(norm(said)) ? b.options[1] : null)
    return o ? { value: o.id, display: o.title } : null
  },
} satisfies AnswerModule<'yes_no_fork'>
