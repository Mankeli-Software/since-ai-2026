import { CloseCallView } from '@/features/result/views/CloseCallView'
import type { BlockProps } from '../types'

export const type = 'close_call'

/** Display: two near-tied options for one part (R3 aside, K5). A light card, so it reads on light and dark. */
export function Component({ block }: BlockProps<'close_call'>) {
  return (
    <CloseCallView part={block.part} a={block.a} b={block.b} tradeoff={block.tradeoff} next_step={block.next_step} />
  )
}
