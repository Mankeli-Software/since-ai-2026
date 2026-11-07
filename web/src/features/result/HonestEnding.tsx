import { calloutCls } from '../genui/ui'
import type { Gate } from './types'

/** Plain statement of what is uncertain. No swing tips, no practice advice (L18). */
export function HonestEnding({ gate }: { gate: Gate }) {
  const text =
    gate === 'provisional'
      ? "This is an honest starting point, not gospel. A couple of specs are right on the edge. Hit 10 balls with a Takomo test club in a simulator bay and we'll settle the debate with cold hard numbers."
      : "We don't have enough real data to recommend a build without guessing—and at Takomo, we don't guess. Hit a few balls in a simulator bay or import launch monitor shots, and we'll dial you in properly."
  return (
    <p className={calloutCls} role="note">
      {text}
    </p>
  )
}
