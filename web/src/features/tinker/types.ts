import type { components } from '@/api/schema.gen'

export type Spec = components['schemas']['Spec']
export type HeadSlug = Spec['head']
export type Flex = Spec['flex']
export type Material = Spec['material']
export type GripSize = Spec['grip']
export type Handedness = Spec['handedness']
export type TinkerResult = components['schemas']['TinkerResult']
export type HeadFlight = components['schemas']['HeadFlight']

export interface TinkerOverrides {
  head: HeadSlug
  length_in: number
  lie_deg: number
  flex: Flex
  material: Material
  shaft: string
  grip: GripSize
  handedness: Handedness
}
