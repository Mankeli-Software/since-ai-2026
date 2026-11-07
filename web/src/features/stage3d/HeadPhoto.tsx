import { DEFAULT_ASSET_BASE, type HeadSlug } from './manifest'

/** Issue #3 photo cutout, for when WebGL or the GLB is unavailable. Plain DOM, no three.js. */
export function HeadPhoto({ slug, base = DEFAULT_ASSET_BASE, view = 'photo_upright' }: { slug: HeadSlug; base?: string; view?: string }) {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: 240 }}>
      <img src={`${base}/images/${slug}/${view}.webp`} alt={slug} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  )
}
