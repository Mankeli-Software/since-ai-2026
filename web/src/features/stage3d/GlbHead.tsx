import { useEffect, useMemo } from 'react'
import { createPortal, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import type { Material, Mesh, MeshStandardMaterial } from 'three'
import { headUrl, type HeadSlug } from './manifest'
import type { HeadProps } from './PlaceholderHead'

export interface GlbHeadProps extends HeadProps {
  slug: HeadSlug
  base: string
}

/**
 * Same slot contract as PlaceholderHead, drawn from `heads/<slug>.glb` (issue #3 frame).
 * `children` are portalled into the GLB's own `HoselSocket` node. Suspends while loading; throws if the node is missing.
 * The GLB keeps its own look; only the rig's highlight/ghost state (opacity, emissive) is copied from `material`.
 */
export function GlbHead({ slug, base, material, children }: GlbHeadProps) {
  const { scene } = useGLTF(headUrl(base, slug))
  const { root, socket, mats } = useMemo(() => {
    const root = scene.clone(true) // per-instance copy so the club row can reuse one cached GLB
    const mats: MeshStandardMaterial[] = []
    root.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh) return
      const own = (m: Material) => {
        const c = m.clone() as MeshStandardMaterial
        mats.push(c)
        return c
      }
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(own) : own(mesh.material)
    })
    const socket = root.getObjectByName('HoselSocket')
    if (!socket) throw new Error(`${slug}.glb has no HoselSocket node`)
    return { root, socket, mats }
  }, [scene, slug])

  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    invalidate() // demand loop: draw once the GLB has replaced the placeholder
    return () => mats.forEach((m) => m.dispose())
  }, [mats, invalidate])

  // Highlight/ghost state lives on the rig's head material; mirror it (demand loop: rig invalidates on change).
  useFrame(() => {
    const ghost = !material.depthWrite
    for (const m of mats) {
      if (m.transparent !== material.transparent) {
        m.transparent = material.transparent
        m.needsUpdate = true
      }
      m.opacity = material.opacity
      m.depthWrite = material.depthWrite
      m.emissive.copy(material.emissive)
      m.emissiveIntensity = material.emissiveIntensity
      if (ghost) m.color.copy(material.color)
    }
  })

  return (
    <>
      <primitive object={root} />
      {createPortal(children, socket)}
    </>
  )
}
