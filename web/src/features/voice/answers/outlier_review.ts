import { norm } from '../spoken'
import { orList, type AnswerModule } from './types'

type Action = 'keep' | 'exclude' | 'confirm_value'

const SAY: Record<Action, string> = {
  keep: 'keep them as they are',
  exclude: 'leave those shots out',
  confirm_value: 'go with the measured number',
}
const LABEL: Record<Action, string> = { keep: 'Keep', exclude: 'Leave them out', confirm_value: 'Use the measured number' }
const HEARD: Record<Action, RegExp> = {
  keep: /\b(keep|leave (it|them) (in|as))\b/,
  exclude: /\b(exclude|leave (it|them|those)( shots)? out|drop|remove|throw)\b/,
  confirm_value: /\b(measured|confirm|use (the )?(real|measured)|trackman|correct|right)\b/,
}

/** Same `{action, codes}` as the buttons; a plain "yes" takes the main action. */
export default {
  type: 'outlier_review',
  ask: (b) => `Do you want to ${orList(b.actions.map((a) => SAY[a]))}?`,
  resolve(b, said) {
    const n = norm(said)
    const codes = b.flags.map((f) => f.code)
    const hits = b.actions.filter((a) => HEARD[a].test(n))
    const main: Action = b.actions.includes('confirm_value') ? 'confirm_value' : 'exclude'
    const a = hits.length === 1 ? hits[0] : hits.length === 0 && /^yes\b/.test(n) && b.actions.includes(main) ? main : null
    return a ? { value: { action: a, codes }, display: LABEL[a] } : null
  },
} satisfies AnswerModule<'outlier_review'>
