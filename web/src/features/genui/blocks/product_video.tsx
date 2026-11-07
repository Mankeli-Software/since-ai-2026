import { ProductVideoView } from '../../result/Cards'
import type { BlockProps } from '../types'

export const type = 'product_video'

export function Component({ block }: BlockProps<'product_video'>) {
  return <ProductVideoView head={block.head} />
}
