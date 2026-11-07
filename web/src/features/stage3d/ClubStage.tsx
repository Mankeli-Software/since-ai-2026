import { forwardRef, useCallback, useState, useEffect, useImperativeHandle, useMemo, useRef, type ElementRef, type Ref } from 'react'
import { Canvas } from '@react-three/fiber'
import { CameraControls, Environment, Html, Lightformer } from '@react-three/drei'
import { ClubRig } from './ClubRig'
import { FALLBACK_PRESETS } from './constants'
import { HeadPhoto } from './HeadPhoto'
import { DEFAULT_ASSET_BASE, useManifest } from './manifest'
import type { CameraPreset, ClubSpec, ClubStageHandle, ClubStageProps, GripSize } from './types'
import { hasWebGL } from './webgl'

const labelStyle = {
  font: '600 11px system-ui, sans-serif',
  color: '#0b0d10',
  background: '#7fe3da',
  padding: '2px 6px',
  borderRadius: 4,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
} as const

interface SceneProps extends ClubStageProps {
  stageRef: Ref<ClubStageHandle>
  onHeadError: (e: Error) => void
}

function Scene({ stageRef, handedness = 'right', shaftMaterial = 'steel', length = 0, lie = 0, grip = 'standard', ghost, focus = 'addressDTL', highlight = null, cameraPresets: presetsProp, head, assetBase = DEFAULT_ASSET_BASE, onHeadError }: SceneProps) {
  const manifest = useManifest(assetBase)
  const cameraPresets = presetsProp ?? manifest?.defaultCameraPresets
  const left = handedness === 'left'
  const rig = useRef<ClubStageHandle>(null)
  const ghostRig = useRef<ClubStageHandle>(null)
  const controls = useRef<ElementRef<typeof CameraControls>>(null)
  const firstFocus = useRef(true)
  const cur = useRef({ length: 0, lie: 0 })
  const ghostSpec = useRef<Partial<ClubSpec> | null | undefined>(ghost)
  ghostSpec.current = ghost
  const lenEl = useRef<HTMLDivElement | null>(null)
  const lieEl = useRef<HTMLDivElement | null>(null)

  // Diff labels are written straight into the DOM so slider drags never re-render React.
  const refreshLabels = useCallback(() => {
    const g = ghostSpec.current
    const set = (el: HTMLDivElement | null, text: string) => {
      if (!el) return
      el.textContent = text
      el.style.display = text ? 'block' : 'none'
    }
    const dl = g?.length === undefined ? 0 : cur.current.length - g.length
    const dg = g?.lie === undefined ? 0 : cur.current.lie - g.lie
    set(lenEl.current, Math.abs(dl) < 0.05 ? '' : `${dl > 0 ? '+' : ''}${dl.toFixed(1)} in`)
    set(lieEl.current, Math.abs(dg) < 0.05 ? '' : `${dg > 0 ? '+' : ''}${dg.toFixed(dg % 1 ? 1 : 0)}° ${dg > 0 ? 'upright' : 'flat'}`)
  }, [])

  const api = useMemo<ClubStageHandle>(
    () => ({
      setLength(v) {
        cur.current.length = v
        rig.current?.setLength(v)
        refreshLabels()
      },
      setLie(v) {
        cur.current.lie = v
        rig.current?.setLie(v)
        refreshLabels()
      },
      setGrip: (s: GripSize) => rig.current?.setGrip(s),
      setShaftMaterial: (k) => rig.current?.setShaftMaterial(k),
    }),
    [refreshLabels],
  )
  useImperativeHandle(stageRef, () => api, [api])

  useEffect(() => api.setLength(length), [api, length])
  useEffect(() => api.setLie(lie), [api, lie])
  useEffect(() => api.setGrip(grip), [api, grip])
  useEffect(() => api.setShaftMaterial(shaftMaterial), [api, shaftMaterial])

  const hasGhost = !!ghost
  useEffect(() => {
    const g = ghostRig.current
    if (!g) return
    g.setLength(ghost?.length ?? 0)
    g.setLie(ghost?.lie ?? 0)
    g.setGrip(ghost?.grip ?? 'standard')
    g.setShaftMaterial(ghost?.shaftMaterial ?? shaftMaterial)
    refreshLabels()
  }, [hasGhost, ghost?.length, ghost?.lie, ghost?.grip, ghost?.shaftMaterial, shaftMaterial, refreshLabels])

  useEffect(() => {
    const c = controls.current
    const p: CameraPreset | undefined = cameraPresets?.[focus] ?? FALLBACK_PRESETS[focus]
    if (!c || !p) return
    const m = left ? -1 : 1 // presets are for the right-handed frame
    const animate = !firstFocus.current
    firstFocus.current = false
    void c.setLookAt(p.position[0] * m, p.position[1], p.position[2], p.target[0] * m, p.target[1], p.target[2], animate)
  }, [focus, left, cameraPresets])

  const setLenEl = useCallback((el: HTMLDivElement | null) => { lenEl.current = el; refreshLabels() }, [refreshLabels])
  const setLieEl = useCallback((el: HTMLDivElement | null) => { lieEl.current = el; refreshLabels() }, [refreshLabels])

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[0.5, 1, -0.6]} intensity={2} />
      <Environment resolution={64} frames={1}>
        <Lightformer intensity={2} position={[0, 3, -3]} scale={[8, 4, 1]} />
        <Lightformer intensity={1} position={[-4, 1, 2]} scale={[4, 4, 1]} />
        <Lightformer intensity={1} position={[4, 1, 2]} scale={[4, 4, 1]} />
      </Environment>
      <ClubRig ref={rig} left={left} highlight={highlight} head={head} assetBase={assetBase} onHeadError={onHeadError} />
      {hasGhost && (
        <ClubRig
          ref={ghostRig}
          ghost
          left={left}
          head={head}
          assetBase={assetBase}
          headSlot={<Html center><div ref={setLieEl} style={labelStyle} /></Html>}
          gripSlot={<Html center><div ref={setLenEl} style={labelStyle} /></Html>}
        />
      )}
      <CameraControls ref={controls} makeDefault minDistance={0.05} maxDistance={2} />
    </>
  )
}

/** Lazy-loadable club stage. Drive drags through the ref handle, discrete changes through props. */
const ClubStage = forwardRef<ClubStageHandle, ClubStageProps>(function ClubStage(props, ref) {
  const [failed, setFailed] = useState(false)
  const onHeadError = useCallback(() => setFailed(true), [])
  if (props.head && (failed || !hasWebGL())) return <HeadPhoto slug={props.head} base={props.assetBase} />
  return (
    <div style={{ width: '100%', height: '100%', minHeight: 240 }}>
      <Canvas frameloop="demand" dpr={[1, 2]} camera={{ fov: 30, near: 0.01, far: 10, position: [0.04, 0.14, -0.42] }}>
        <Scene {...props} stageRef={ref} onHeadError={onHeadError} />
      </Canvas>
    </div>
  )
})

export default ClubStage
