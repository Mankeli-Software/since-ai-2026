import { ProductVideo } from '@/features/result/ProductVideo'
import type { HeadSlug } from '@/features/result/ProductVideo'

export const type = 'product_video'

export interface ProductVideoBlockProps {
  block?: { head?: HeadSlug; type?: 'product_video' }
  head?: HeadSlug
  className?: string
}

export function Component(props: ProductVideoBlockProps) {
  const head = props.block?.head ?? props.head ?? '201t-mkii'
  return <ProductVideo head={head} className={props.className} />
}
