import { StockVsCustomView } from '../../result/StockVsCustom'
import type { BlockProps } from '../types'

export const type = 'stock_vs_custom'

export function Component({ block, interactive, answer, busy, respond }: BlockProps<'stock_vs_custom'>) {
  return (
    <StockVsCustomView
      question={block.question}
      reasons={block.reasons ?? []}
      stockReturnDays={block.stock_return_days ?? 30}
      customReturnable={block.custom_returnable ?? false}
      locked={!interactive || busy}
      picked={answer ? String(answer.value) : undefined}
      onPick={(v) => respond(v, v === 'stock' ? 'Stock' : 'Custom')}
    />
  )
}
