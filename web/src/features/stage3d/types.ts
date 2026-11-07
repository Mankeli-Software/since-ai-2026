export type Handedness = 'right' | 'left'
export type ShaftMaterialKind = 'steel' | 'graphite'
export type GripSize = 'standard' | 'midsize' | 'oversize'
export type ClubPart = 'head' | 'shaft' | 'grip'
export type CameraPresetName = 'grip' | 'shaft' | 'headFace' | 'addressDTL' | 'clubRow'

/** Same shape as manifest.json `defaultCameraPresets[name]` (metres, unmirrored right-handed frame). */
export interface CameraPreset {
  position: [number, number, number]
  target: [number, number, number]
}

/** A club spec. `length` is inches vs stock 37 in (-1.5..+1.5); `lie` is degrees vs standard (-3 flat..+3 upright). */
export interface ClubSpec {
  length: number
  lie: number
  grip: GripSize
  shaftMaterial: ShaftMaterialKind
}

export interface ClubStageProps {
  handedness?: Handedness
  shaftMaterial?: ShaftMaterialKind
  /** Applied on mount and whenever the value changes. For drag ticks use the handle instead. */
  length?: number
  lie?: number
  grip?: GripSize
  /** Recommended club, drawn as a translucent ghost with diff labels. */
  ghost?: Partial<ClubSpec> | null
  focus?: CameraPresetName
  /** Emissive pulse on this part; the rest dims to 0.35 opacity. */
  highlight?: ClubPart | null
  /** Head GLB slug from manifest `headOrder`. Omitted = placeholder head. Falls back to the photo cutout if it fails. */
  head?: string
  /** Where manifest.json, heads/ and images/ are served. Default `/assets/clubs`. */
  assetBase?: string
  /** manifest.json `defaultCameraPresets`; fetched from the manifest when omitted, built-in constants as last resort. */
  cameraPresets?: Partial<Record<string, CameraPreset>>
}

/** Imperative API: mutates three.js objects and invalidates. Never touches React state. */
export interface ClubStageHandle {
  setLength(inches: number): void
  setLie(deg: number): void
  setGrip(size: GripSize): void
  setShaftMaterial(kind: ShaftMaterialKind): void
}
