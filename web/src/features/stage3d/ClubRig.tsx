import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Outlines } from '@react-three/drei'
import { CylinderGeometry, MathUtils, type Group, type Mesh } from 'three'
import { GRIP_LEN, GRIP_SCALE, IN, SHAFT_LEN } from './constants'
import { PART_MATS, applyShaftMaterial, disposeMaterials, makeMaterials } from './materials'
import { PlaceholderHead } from './PlaceholderHead'
import type { ClubPart, ClubStageHandle } from './types'

const shaftGeo = new CylinderGeometry(0.00762, 0.0047, SHAFT_LEN, 12).translate(0, SHAFT_LEN / 2, 0)
const ferruleGeo = new CylinderGeometry(0.00625, 0.00670, 0.019, 12).translate(0, 0.0095, 0)
const gripGeo = new CylinderGeometry(0.0135, 0.008, GRIP_LEN, 16).translate(0, GRIP_LEN / 2, 0)

export interface ClubRigProps {
  ghost?: boolean
  left?: boolean
  highlight?: ClubPart | null
  /** Extra nodes in the lie-rotated club frame (e.g. a label above the head). */
  headSlot?: ReactNode
  /** Extra nodes at the top of the grip. */
  gripSlot?: ReactNode
}

/** Mirror(scale.x) > Lie(rotation.z about sole contact) > Head > HoselSocket > ferrule, shaft, grip. */
export const ClubRig = forwardRef<ClubStageHandle, ClubRigProps>(function ClubRig(
  { ghost = false, left = false, highlight = null, headSlot, gripSlot },
  ref,
) {
  const invalidate = useThree((s) => s.invalidate)
  const mats = useMemo(() => makeMaterials(ghost), [ghost])
  const lieRef = useRef<Group>(null)
  const shaftRef = useRef<Mesh>(null)
  const gripRef = useRef<Group>(null)
  const hl = useRef<ClubPart | null>(null)

  useEffect(() => () => disposeMaterials(mats), [mats])

  useImperativeHandle(
    ref,
    () => ({
      setLength(inches) {
        const s = 1 + (inches * IN) / SHAFT_LEN
        if (shaftRef.current) shaftRef.current.scale.y = s
        if (gripRef.current) gripRef.current.position.y = SHAFT_LEN * s - GRIP_LEN
        invalidate()
      },
      setLie(deg) {
        if (lieRef.current) lieRef.current.rotation.z = MathUtils.degToRad(-deg)
        invalidate()
      },
      setGrip(size) {
        const k = GRIP_SCALE[size]
        gripRef.current?.scale.set(k, 1, k)
        invalidate()
      },
      setShaftMaterial(kind) {
        applyShaftMaterial(mats, kind, ghost)
        invalidate()
      },
    }),
    [mats, ghost, invalidate],
  )

  // Dim everything but the highlighted part; the pulse itself runs in useFrame.
  useEffect(() => {
    if (ghost) return
    hl.current = highlight
    ;(Object.keys(PART_MATS) as ClubPart[]).forEach((part) =>
      PART_MATS[part].forEach((k) => {
        const m = mats[k]
        const dim = highlight !== null && part !== highlight
        if (m.transparent !== dim) {
          m.transparent = dim
          m.needsUpdate = true
        }
        m.opacity = dim ? 0.35 : 1
        m.emissiveIntensity = 0
      }),
    )
    invalidate()
  }, [highlight, ghost, mats, invalidate])

  useFrame(({ clock }) => {
    const part = hl.current
    if (!part) return
    const k = 0.35 + 0.25 * Math.sin(clock.elapsedTime * 5)
    PART_MATS[part].forEach((n) => (mats[n].emissiveIntensity = k))
    invalidate()
  })

  const outline = !ghost && <Outlines thickness={0.0006} color="#0b0d10" />

  return (
    <group scale-x={left ? -1 : 1} renderOrder={ghost ? 1 : 0}>
      <group ref={lieRef}>
        <PlaceholderHead material={mats.head} outlined={!ghost}>
          <mesh geometry={ferruleGeo} material={mats.ferrule}>{outline}</mesh>
          <mesh ref={shaftRef} geometry={shaftGeo} material={mats.shaft} />
          <group ref={gripRef} position-y={SHAFT_LEN - GRIP_LEN}>
            <mesh geometry={gripGeo} material={mats.grip}>{outline}</mesh>
            {gripSlot && <group position-y={GRIP_LEN}>{gripSlot}</group>}
          </group>
        </PlaceholderHead>
        {headSlot && <group position={[0, 0.09, 0]}>{headSlot}</group>}
      </group>
    </group>
  )
})
