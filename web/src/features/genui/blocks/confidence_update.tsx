import { ConfidenceUpdateView } from '@/features/result/views/ConfidenceUpdateView'
import type { BlockProps } from '../types'

export const type = 'confidence_update'

/** Display: how much fit confidence moved after an answer (C5, K5). Light; sits in the conversation card. */
export function Component({ block }: BlockProps<'confidence_update'>) {
  return (
    <ConfidenceUpdateView
      before={block.before}
      after={block.after}
      changes={block.changes}
      left_count={block.left_count}
    />
  )
}
