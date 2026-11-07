import { WhyPanelView } from '../../result/WhyPanel'
import type { BlockProps } from '../types'

export const type = 'why_panel'

export function Component({ block }: BlockProps<'why_panel'>) {
  return <WhyPanelView items={block.items} depth={block.depth} />
}
