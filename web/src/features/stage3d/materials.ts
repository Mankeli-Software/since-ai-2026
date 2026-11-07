import { Color, MeshStandardMaterial } from 'three'
import type { ClubPart, ShaftMaterialKind } from './types'

export interface RigMaterials {
  head: MeshStandardMaterial
  shaft: MeshStandardMaterial
  ferrule: MeshStandardMaterial
  grip: MeshStandardMaterial
}

export const PART_MATS: Record<ClubPart, (keyof RigMaterials)[]> = {
  head: ['head'],
  shaft: ['shaft', 'ferrule'],
  grip: ['grip'],
}

const GHOST_TINT = '#3fb8af'

/** One set per rig instance (created once via useMemo). Ghost sets are translucent and never write depth. */
export function makeMaterials(ghost: boolean): RigMaterials {
  const mk = (color: string, metalness: number, roughness: number) => {
    const m = new MeshStandardMaterial({
      color: ghost ? GHOST_TINT : color,
      metalness,
      roughness,
      emissive: new Color('#ffb347'),
      emissiveIntensity: 0,
    })
    if (ghost) {
      m.transparent = true
      m.opacity = 0.2
      m.depthWrite = false
    }
    return m
  }
  return {
    head: mk('#b9bfc6', 0.9, 0.25),
    shaft: mk('#d8dde2', 0.96, 0.14),
    ferrule: mk('#15171a', 0.3, 0.2),
    grip: mk('#1b1c1e', 0, 0.85),
  }
}

export function applyShaftMaterial(m: RigMaterials, kind: ShaftMaterialKind, ghost: boolean): void {
  const steel = kind === 'steel'
  if (!ghost) m.shaft.color.set(steel ? '#d8dde2' : '#22252a')
  m.shaft.metalness = steel ? 0.96 : 0.25
  m.shaft.roughness = steel ? 0.14 : 0.42
}

export function disposeMaterials(m: RigMaterials): void {
  Object.values(m).forEach((x) => x.dispose())
}
