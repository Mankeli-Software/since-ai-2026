import { Component, Suspense, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Outlines } from '@react-three/drei'
import { CylinderGeometry, MathUtils, type Group, type Mesh } from 'three'
import { GRIP_LEN, GRIP_SCALE, IN, SHAFT_LEN } from './constants'
import { PART_MATS, applyShaftMaterial, disposeMaterials, makeMaterials } from './materials'
import { GlbHead } from './GlbHead'
import { DEFAULT_ASSET_BASE, type HeadSlug } from './manifest'
import { PlaceholderHead } from './PlaceholderHead'
import type { ClubPart, ClubStageHandle } from './types'

const shaftGeo = new CylinderGeometry(0.00762, 0.0047, SHAFT_LEN, 12).translate(0, SHAFT_LEN / 2, 0)
const ferruleGeo = new CylinderGeometry(0.00625, 0.00670, 0.019, 12).translate(0, 0.0095, 0)
const gripGeo = new CylinderGeometry(0.0135, 0.008, GRIP_LEN, 16).translate(0, GRIP_LEN / 2, 0)

/** Catches GLB load errors; shows the placeholder instead and reports once. */
class HeadBoundary extends Component<{ fallback: ReactNode; onError?: (e: Error) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e: Error) { this.props.onError?.(e) }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

export interface ClubRigProps {
  /** Head GLB slug; omitted = PlaceholderHead. */
  head?: HeadSlug
  assetBase?: string
  onHeadError?: (e: Error) => void
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
  { head, assetBase = DEFAULT_ASSET_BASE, onHeadError, ghost = false, left = false, highlight = null, headSlot, gripSlot },
  ref,
) {
  const invalidate = useThree((s) => s.invalidate)
  const mats = useMemo(() => makeMaterials(ghost), [ghost])
  const lieRef = useRef<Group>(null)
  const shaftRef = useRef<Mesh | null>(null)
  const gripRef = useRef<Group | null>(null)
  // Length/grip are re-applied by callback refs: the club subtree remounts when the head swaps in.
  const dims = useRef({ lenScale: 1, grip: 1 })
  const setShaft = useCallback((m: Mesh | null) => {
    shaftRef.current = m
    m?.scale.setY(dims.current.lenScale)
  }, [])
  const setGripGroup = useCallback((g: Group | null) => {
    gripRef.current = g
    if (!g) return
    g.position.y = SHAFT_LEN * dims.current.lenScale - GRIP_LEN
    g.scale.set(dims.current.grip, 1, dims.current.grip)
  }, [])
  const hl = useRef<ClubPart | null>(null)

  useEffect(() => () => disposeMaterials(mats), [mats])

  useImperativeHandle(
    ref,
    () => ({
      setLength(inches) {
        const s = 1 + (inches * IN) / SHAFT_LEN
        dims.current.lenScale = s
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
        dims.current.grip = k
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
        {(() => {
          const club = (
            <>
              <mesh geometry={ferruleGeo} material={mats.ferrule}>{outline}</mesh>
              <mesh ref={setShaft} geometry={shaftGeo} material={mats.shaft} />
              <group ref={setGripGroup}>
                <mesh geometry={gripGeo} material={mats.grip}>{outline}</mesh>
                {gripSlot && <group position-y={GRIP_LEN}>{gripSlot}</group>}
              </group>
            </>
          )
          const placeholder = <PlaceholderHead material={mats.head} outlined={!ghost}>{club}</PlaceholderHead>
          if (!head) return placeholder
          return (
            <HeadBoundary key={head} fallback={placeholder} onError={onHeadError}>
              <Suspense fallback={placeholder}>
                <GlbHead slug={head} base={assetBase} material={mats.head}>{club}</GlbHead>
              </Suspense>
            </HeadBoundary>
          )
        })()}
        {headSlot && <group position={[0, 0.09, 0]}>{headSlot}</group>}
      </group>
    </group>
  )
})
