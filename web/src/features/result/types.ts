import type { UIBlock } from '@/api/client'

export type Gate = Extract<UIBlock, { type: 'recommendation_card' }>['gate']
export type Spec = Extract<UIBlock, { type: 'recommendation_card' }>['spec']
