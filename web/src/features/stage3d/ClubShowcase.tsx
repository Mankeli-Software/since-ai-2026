import { Component, Suspense, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, useGLTF } from '@react-three/drei'
import { MathUtils, type Group, type PerspectiveCamera } from 'three'
import { ClubRig } from './ClubRig'
import { DEFAULT_ASSET_BASE, headUrl, type HeadSlug } from './manifest'

export interface ClubShowcaseProps {
  slug: HeadSlug
  /** Slow sway and float. The host turns it off for prefers-reduced-motion and while scrolled out of view. */
  moving: boolean
  /** Called once the head has been drawn, so the host can fade the canvas in over the photo. */
  onReady?: () => void
  onError?: (e: Error) => void
  assetBase?: string
}

// Composition in the issue #3 frame (metres). The camera looks along +Z from behind, so screen-right is -X (toe).
const HEAD_CENTRE: [number, number, number] = [0.004, 0.03, -0.012]
const DIST = 0.62
// Visible width: head plus hosel is about 60% of it, which leaves room for the host's spotlight fade.
const VIEW_W = 0.18
// Wide boxes fit by height instead, so the head stays inside the fade's vertical core.
const MIN_VIEW_H = 0.135
// Camera raised by this share of the visible height, so the head sits at 56% from the top.
const PAN_Y = 0.06

/** Pins the camera behind the head and fits the composition to the canvas aspect. */
function Frame() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const aspect = useThree((s) => s.size.width / s.size.height)
  const invalidate = useThree((s) => s.invalidate)
  useLayoutEffect(() => {
    const h = Math.max(VIEW_W / aspect, MIN_VIEW_H)
    camera.fov = MathUtils.radToDeg(2 * Math.atan(h / 2 / DIST))
    const [x, y, z] = HEAD_CENTRE
    camera.position.set(x, y + PAN_Y * h, z - DIST)
    camera.lookAt(x, y + PAN_Y * h, z)
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, aspect, invalidate])
  return null
}

const TAU = Math.PI * 2

// Turntable yaw: rest on the back (badge side), turn past edge-on until the face shows, rest, turn back.
// The face side is negative yaw, so the shaft swings away from the camera instead of through it.
const YAW_BACK = 0.15
const YAW_FACE = -2.25
const CYCLE = 24 // s: back 9, turn 6, face 3, turn back 6

/** 0 = back view, 1 = face view, eased between. */
function turnAt(t: number) {
  const u = t % CYCLE
  const ease = (x: number) => x * x * (3 - 2 * x)
  if (u < 9) return 0
  if (u < 15) return ease((u - 9) / 6)
  if (u < 18) return 1
  return 1 - ease((u - 18) / 6)
}

/**
 * Slow turntable about the head centre, with a gentle sway, a touch of roll and a few millimetres of float.
 * Phase comes from the page clock, so every showcase on screen moves together and a fresh page starts on
 * the back view. The amplitude eases in from the rest pose (which matches the photo poster) and eases out
 * when `moving` turns off.
 */
function Sway({ moving, children }: { moving: boolean; children: ReactNode }) {
  const pivot = useRef<Group>(null)
  const amp = useRef(0)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    if (moving) invalidate() // demand loop: restart the frame chain
  }, [moving, invalidate])
  useFrame((_, dt) => {
    const g = pivot.current
    if (!g) return
    const step = Math.min(dt, 0.1)
    amp.current = moving ? Math.min(1, amp.current + step / 3) : Math.max(0, amp.current - step / 1.2)
    const a = amp.current * amp.current * (3 - 2 * amp.current)
    const t = performance.now() / 1000
    g.rotation.y = a * (YAW_BACK + (YAW_FACE - YAW_BACK) * turnAt(t) + 0.12 * Math.sin((t * TAU) / 8))
    g.rotation.z = a * 0.035 * Math.sin((t * TAU) / 9.5)
    g.position.y = HEAD_CENTRE[1] + a * 0.0018 * Math.sin((t * TAU) / 6.5)
    if (moving || amp.current > 0) invalidate()
  })
  return (
    <group ref={pivot} position={HEAD_CENTRE}>
      <group position={[-HEAD_CENTRE[0], -HEAD_CENTRE[1], -HEAD_CENTRE[2]]}>{children}</group>
    </group>
  )
}

/** Suspends until the head GLB is cached, so ClubRig never shows its placeholder box. */
function Club({ slug, base }: { slug: HeadSlug; base: string }) {
  useGLTF(headUrl(base, slug))
  return <ClubRig head={slug} assetBase={base} />
}

/** Mounts with the loaded club; reports after the first drawn frame. */
function Ready({ onReady }: { onReady?: () => void }) {
  const invalidate = useThree((s) => s.invalidate)
  const cb = useRef(onReady)
  cb.current = onReady
  useEffect(() => {
    invalidate()
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => cb.current?.())
    })
    return () => cancelAnimationFrame(id)
  }, [invalidate])
  return null
}

class LoadBoundary extends Component<{ onError?: (e: Error) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e: Error) { this.props.onError?.(e) }
  render() { return this.state.failed ? null : this.props.children }
}

/**
 * Hero product shot of one head on a transparent canvas: back view, studio reflections with a warm rim,
 * slow sway. No controls. Fills its parent; the host owns layout, the edge fade and the photo fallback.
 * Lazy-load it: `lazy(() => import('@/features/stage3d/ClubShowcase'))`.
 */
export default function ClubShowcase({ slug, moving, onReady, onError, assetBase = DEFAULT_ASSET_BASE }: ClubShowcaseProps) {
  return (
    <Canvas frameloop="demand" dpr={[1, 2]} camera={{ fov: 20, near: 0.01, far: 10 }} style={{ pointerEvents: 'none' }}>
      <Frame />
      <ambientLight intensity={0.25} />
      <directionalLight position={[-0.6, 1, -1]} intensity={1.6} />
      <Environment resolution={256} frames={1}>
        {/* Grey studio walls so the chrome never mirrors black; softboxes add the product-shot highlights. */}
        <color attach="background" args={['#5a5a5a']} />
        <Lightformer form="rect" intensity={4} position={[0, 2.5, -3]} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={3} position={[0, -1.5, -3]} scale={[10, 1.2, 1]} />
        <Lightformer form="rect" intensity={2.5} position={[-4, 1, -1]} scale={[3, 6, 1]} />
        <Lightformer form="rect" intensity={2} position={[4, 0.5, -1]} scale={[2, 6, 1]} />
        <Lightformer form="rect" intensity={6} position={[0, 5, 0]} scale={[8, 8, 1]} />
        <Lightformer form="rect" intensity={3} color="#ff6e01" position={[-3, -0.5, 3]} scale={[5, 2, 1]} />
      </Environment>
      <LoadBoundary key={slug} onError={onError}>
        <Suspense fallback={null}>
          <Sway moving={moving}>
            <Club slug={slug} base={assetBase} />
          </Sway>
          <Ready onReady={onReady} />
        </Suspense>
      </LoadBoundary>
    </Canvas>
  )
}
