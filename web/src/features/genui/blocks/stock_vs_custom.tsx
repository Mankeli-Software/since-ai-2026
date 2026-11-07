import { useSession } from '@/store/session'
import { StockVsCustomView } from '../../result/StockVsCustom'
import type { BlockProps } from '../types'
import { Answered } from './_parts/Answered'

export const type = 'stock_vs_custom'

/** R5 radio cards on the light card. Resumes with 'stock' | 'custom' (unchanged). */
// Parts that make a set custom (non-returnable) when they leave standard.
const CUSTOM_PARTS = ['lie', 'length'] as const

/** #114 ticket 6: when a close call drives the custom spec, say so before the golfer picks. Numbers
 * come from the live meter (per_part share), never from copy. Plain callout, no orange. */
function ReturnabilityAlert() {
  const state = useSession((s) => s.state)
  if (state?.best?.purchase !== 'custom') return null
  const part = CUSTOM_PARTS.find((p) => state.per_part?.[p]?.close_call)
  if (!part) return null
  const pc = state.per_part?.[part]
  if (!pc) return null
  return (
    <div role="note" className="rounded-md border border-border bg-background px-4 py-3 text-sm leading-snug">
      <strong>Before you choose custom:</strong> your {part} is a close call ({Math.round(pc.share * 100)}% of
      possible fits agree), and a custom build can't be returned.{' '}
      {pc.next_step ?? 'A session with a Takomo test club would settle it before you order.'}
    </div>
  )
}

export function Component({ block, interactive, answer, busy, respond }: BlockProps<'stock_vs_custom'>) {
  if (!interactive || answer) return <Answered prompt={block.question} answer={answer} />
  return (
    <>
    <ReturnabilityAlert />
    <StockVsCustomView
      question={block.question}
      reasons={block.reasons ?? []}
      stockReturnDays={block.stock_return_days ?? 30}
      customReturnable={block.custom_returnable ?? false}
      locked={busy}
      onPick={(v) => respond(v, v === 'stock' ? 'Stock' : 'Custom')}
    />
    </>
  )
}
