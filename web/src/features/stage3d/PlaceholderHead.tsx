import { CylinderGeometry, BoxGeometry } from 'three'
import type { ReactNode } from 'react'
import { Outlines } from '@react-three/drei'
import { SOCKET_POS, SOCKET_QUAT } from './constants'
import type { RigMaterials } from './materials'

// Built once at module scope. Origin = sole ground-contact point, +Y up, +Z target, +X heel, -X toe.
const bladeGeo = new BoxGeometry(0.1, 0.055, 0.03)
const hoselGeo = new CylinderGeometry(0.0085, 0.0085, 0.03, 12).translate(0, -0.015, 0)

export interface HeadProps {
  material: RigMaterials['head']
  /** Rendered inside the node named `HoselSocket` (local +Y along the shaft). */
  children?: ReactNode
  outlined?: boolean
}

/**
 * Head slot contract (swap point for issue #48): a component that takes `material` + `children`,
 * draws the head at the issue #3 origin, and renders `children` inside a node named "HoselSocket".
 */
export function PlaceholderHead({ material, children, outlined }: HeadProps) {
  return (
    <group name="Head">
      <mesh geometry={bladeGeo} material={material} position={[0, 0.0275, -0.01]}>
        {outlined && <Outlines thickness={0.0006} color="#0b0d10" />}
      </mesh>
      <group name="HoselSocket" position={SOCKET_POS} quaternion={SOCKET_QUAT}>
        <mesh geometry={hoselGeo} material={material} />
        {children}
      </group>
    </group>
  )
}
