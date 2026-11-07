import { useEffect, useState } from 'react'
import type { CameraPreset } from './types'

export const DEFAULT_ASSET_BASE = '/assets/clubs'

/** Head slug as listed in manifest.json `headOrder` (a file drop in assets/clubs/heads adds one; no code change). */
export type HeadSlug = string

export interface ClubManifest {
  headOrder: HeadSlug[]
  defaultCameraPresets: Partial<Record<string, CameraPreset>>
  heads: Record<string, { slug: string; name: string; images?: Record<string, string> }>
}

const cache = new Map<string, Promise<ClubManifest>>()

/** Fetches `${base}/manifest.json` once per base. Rejects (and retries next call) on failure. */
export function loadManifest(base = DEFAULT_ASSET_BASE): Promise<ClubManifest> {
  let p = cache.get(base)
  if (!p) {
    p = fetch(`${base}/manifest.json`).then((r) => {
      if (!r.ok) throw new Error(`manifest ${r.status}`)
      return r.json() as Promise<ClubManifest>
    })
    p.catch(() => cache.delete(base))
    cache.set(base, p)
  }
  return p
}

/** null until loaded, and stays null if the manifest is unavailable (callers fall back to built-ins). */
export function useManifest(base = DEFAULT_ASSET_BASE): ClubManifest | null {
  const [m, setM] = useState<ClubManifest | null>(null)
  useEffect(() => {
    let live = true
    loadManifest(base).then((x) => live && setM(x), () => {})
    return () => { live = false }
  }, [base])
  return m
}

export const headUrl = (base: string, slug: HeadSlug) => `${base}/heads/${slug}.glb`
