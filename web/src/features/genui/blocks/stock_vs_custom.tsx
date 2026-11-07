import { StockVsCustomView } from '../../result/StockVsCustom'
import type { BlockProps } from '../types'
import { Answered } from './_parts/Answered'

export const type = 'stock_vs_custom'

/** R5 radio cards on the light card. Resumes with 'stock' | 'custom' (unchanged). */
export function Component({ block, interactive, answer, busy, respond }: BlockProps<'stock_vs_custom'>) {
  if (!interactive || answer) return <Answered prompt={block.question} answer={answer} />
  return (
    <StockVsCustomView
      question={block.question}
      reasons={block.reasons ?? []}
      stockReturnDays={block.stock_return_days ?? 30}
      customReturnable={block.custom_returnable ?? false}
      locked={busy}
      onPick={(v) => respond(v, v === 'stock' ? 'Stock' : 'Custom')}
    />
  )
}
