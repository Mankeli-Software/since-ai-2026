import { Suspense, useEffect, useMemo, useRef, type ElementRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { CameraControls, Environment, Lightformer, useGLTF } from '@react-three/drei'
import { FALLBACK_PRESETS } from './constants'
import { GlbHead } from './GlbHead'
import { DEFAULT_ASSET_BASE, headUrl, loadManifest, useManifest, type HeadSlug } from './manifest'
import { disposeMaterials, makeMaterials } from './materials'
import type { CameraPreset } from './types'

export interface ClubRowProps {
  /** Best-fit head: centred and drawn at x1.15. */
  best: HeadSlug
  /** Highlighted head (full opacity). Defaults to `best`. The others dim. */
  selected?: HeadSlug
  /** Click a head. The host swaps the product video / main stage head. */
  onSelect?: (slug: HeadSlug) => void
  /** Heads to show; defaults to manifest `headOrder`. */
  heads?: HeadSlug[]
  assetBase?: string
  cameraPreset?: CameraPreset
}

const SPACING = 0.1
const BEST_SCALE = 1.15

function RowHead({ slug, base, x, scale, dim, onSelect }: { slug: HeadSlug; base: string; x: number; scale: number; dim: boolean; onSelect?: (s: HeadSlug) => void }) {
  const invalidate = useThree((s) => s.invalidate)
  const mats = useMemo(() => makeMaterials(false), [])
  useEffect(() => () => disposeMaterials(mats), [mats])
  useEffect(() => {
    mats.head.transparent = dim
    mats.head.opacity = dim ? 0.55 : 1
    mats.head.needsUpdate = true
    invalidate()
  }, [dim, mats, invalidate])
  return (
    <group
      position-x={x}
      scale={scale}
      onClick={(e) => { e.stopPropagation(); onSelect?.(slug) }}
      onPointerOver={() => { document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = '' }}
    >
      <GlbHead slug={slug} base={base} material={mats.head} />
    </group>
  )
}

function Row({ best, selected = best, onSelect, heads, assetBase = DEFAULT_ASSET_BASE, cameraPreset }: ClubRowProps) {
  const manifest = useManifest(assetBase)
  const controls = useRef<ElementRef<typeof CameraControls>>(null)
  const preset = cameraPreset ?? manifest?.defaultCameraPresets.clubRow ?? FALLBACK_PRESETS.clubRow
  const list = heads ?? manifest?.headOrder ?? []
  // Best in the middle; camera looks along +Z so screen-right is -X.
  const order = useMemo(() => {
    const rest = list.filter((s) => s !== best)
    rest.splice(Math.floor(list.length / 2), 0, best)
    return rest
  }, [list, best])
  const mid = (order.length - 1) / 2

  useEffect(() => {
    const p = preset
    void controls.current?.setLookAt(...p.position, ...p.target, false)
  }, [preset])

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[0.5, 1, -0.6]} intensity={2} />
      <Environment resolution={64} frames={1}>
        <Lightformer intensity={2} position={[0, 3, -3]} scale={[8, 4, 1]} />
        <Lightformer intensity={1} position={[-4, 1, 2]} scale={[4, 4, 1]} />
        <Lightformer intensity={1} position={[4, 1, 2]} scale={[4, 4, 1]} />
      </Environment>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.001}>
        <planeGeometry args={[2, 2]} />
        <meshStandardMaterial color="#2b3036" roughness={0.9} />
      </mesh>
      <Suspense fallback={null}>
        {order.map((slug, i) => (
          <RowHead key={slug} slug={slug} base={assetBase} x={(mid - i) * SPACING} scale={slug === best ? BEST_SCALE : 1} dim={slug !== selected} onSelect={onSelect} />
        ))}
      </Suspense>
      <CameraControls ref={controls} makeDefault minDistance={0.1} maxDistance={2} />
    </>
  )
}

/** Wave 2 club row: all heads side by side. The host gates it behind `?ff=clubrow`. Lazy-load it like ClubStage. */
export default function ClubRow(props: ClubRowProps) {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: 240 }}>
      <Canvas frameloop="demand" dpr={[1, 2]} camera={{ fov: 30, near: 0.01, far: 10, position: FALLBACK_PRESETS.clubRow.position }}>
        <Row {...props} />
      </Canvas>
    </div>
  )
}

/** Warm the GLB cache (e.g. on landing). Resolves once requests are queued. */
export async function preloadHeads(base = DEFAULT_ASSET_BASE, heads?: HeadSlug[]): Promise<void> {
  const m = await loadManifest(base)
  for (const s of heads ?? m.headOrder) useGLTF.preload(headUrl(base, s))
}
