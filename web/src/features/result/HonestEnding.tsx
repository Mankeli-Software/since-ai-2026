import { calloutCls } from '../genui/ui'
import type { Gate } from './types'

/** Plain statement of what is uncertain. No swing tips, no practice advice (L18). */
export function HonestEnding({ gate }: { gate: Gate }) {
  const text =
    gate === 'provisional'
      ? 'This is a starting point, not a final answer. Some parts are still a close call. A simulator session with a Takomo test club gives the number that settles it.'
      : 'We do not have enough to recommend a build yet. A simulator session with a Takomo test club, or a few more measured shots, gives us the numbers we need.'
  return (
    <p className={calloutCls} role="note">
      {text}
    </p>
  )
}
