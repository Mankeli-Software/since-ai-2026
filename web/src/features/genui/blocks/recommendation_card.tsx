import { RecommendationCardView } from '../../result/RecommendationCard'
import type { BlockProps } from '../types'

export const type = 'recommendation_card'

export function Component({ block }: BlockProps<'recommendation_card'>) {
  return <RecommendationCardView {...block} />
}
