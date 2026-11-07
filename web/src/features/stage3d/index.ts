// Host usage: const ClubStage = React.lazy(() => import('./features/stage3d'))
export { default } from './ClubStage'
export type {
  CameraPreset,
  CameraPresetName,
  ClubPart,
  ClubSpec,
  ClubStageHandle,
  ClubStageProps,
  GripSize,
  Handedness,
  ShaftMaterialKind,
} from './types'
export { default as ClubRow, preloadHeads } from './ClubRow'
export type { ClubRowProps } from './ClubRow'
export { HeadPhoto } from './HeadPhoto'
export { DEFAULT_ASSET_BASE, loadManifest, useManifest } from './manifest'
export type { ClubManifest, HeadSlug } from './manifest'
