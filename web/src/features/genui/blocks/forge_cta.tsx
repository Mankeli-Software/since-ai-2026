import { ForgeCtaView } from '../../result/Cards'
import type { BlockProps } from '../types'

export const type = 'forge_cta'

export function Component({ block }: BlockProps<'forge_cta'>) {
  return <ForgeCtaView topic={block.topic} />
}
