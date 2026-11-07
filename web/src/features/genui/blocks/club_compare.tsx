import { ClubCompareView } from '../../result/ClubCompare'
import type { BlockProps } from '../types'

export const type = 'club_compare'

export function Component({ block }: BlockProps<'club_compare'>) {
  return <ClubCompareView heads={block.heads} highlight={block.highlight} />
}
