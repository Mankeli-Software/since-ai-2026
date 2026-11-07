import { ProductVideo } from '@/features/result/ProductVideo'
import type { BlockProps } from '../types'

export const type = 'product_video'

export function Component({ block }: BlockProps<'product_video'>) {
  return <ProductVideo head={block.head} />
}
