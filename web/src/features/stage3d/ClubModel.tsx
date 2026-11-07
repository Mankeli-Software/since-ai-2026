import { Suspense, lazy, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { ClubImage } from '@/components/studio'
import { cn } from '@/lib/utils'
import { hasWebGL } from './webgl'

const ClubShowcase = lazy(() => import('./ClubShowcase'))

export interface ClubModelProps {
  /** Head slug as in assets/clubs/manifest.json, e.g. '201t-mkii'. */
  slug: string
  /** Empty string (default) = decorative. */
  alt?: string
  /**
   * Layout box. Give it a height; the width follows 4:5 unless set. The head fills about half the box width
   * (the rest is fade room), so make it about 1.45x a ClubImage showing the same head.
   */
  className?: string
  style?: CSSProperties
  /** Slow sway. Default on; always off for prefers-reduced-motion. */
  moving?: boolean
  /** Face view that turns toward the pointer (see ClubShowcase). Default off. */
  follow?: boolean
  /** Below 1 draws the head smaller in the same box, so more of the club shows inside the fade. Default 1. */
  zoom?: number
}

// Spotlight fade centred on the head (ClubShowcase puts it at 50% 56%): the head stays solid, the shaft and
// every edge melt into whatever is behind.
const FADE = 'radial-gradient(closest-side at 50% 56%, #000 64%, transparent)'
const MASK: CSSProperties = { maskImage: FADE, WebkitMaskImage: FADE }
// The photo poster sits in the same virtual 4:5 frame ClubShowcase fits to the box (full width, or height x 4/3
// in wide boxes), shrunk and nudged so its head lines up with the 3D one (the photo is cropped much tighter).
const poster = (zoom: number): CSSProperties => ({
  width: 'min(100cqw, 133.33cqh)',
  transform: `translate(-54%, -59.5%) scale(${0.66 * zoom})`,
  transformOrigin: '60% 61%',
})

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)')
const subscribeMotion = (cb: () => void) => {
  const m = reducedMotion()
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}
const getReducedMotion = () => reducedMotion().matches

/**
 * The 3D club for hero spots: shows the product photo first, then crossfades to a slowly swaying 3D head
 * once its GLB has drawn. Edges fade out on any background. Mounts the canvas only near the viewport and
 * stops animating off screen. Without WebGL, or if the GLB fails, the photo stays.
 */
export function ClubModel({ slug, alt = '', className, style, moving = true, follow = false, zoom = 1 }: ClubModelProps) {
  const box = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const [inView, setInView] = useState(false)
  const [readySlug, setReadySlug] = useState<string | null>(null)
  const [failedSlug, setFailedSlug] = useState<string | null>(null)
  const still = useSyncExternalStore(subscribeMotion, getReducedMotion)
  const ready = readySlug === slug

  useEffect(() => {
    const el = box.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      setInView(e.isIntersecting)
      if (e.isIntersecting) setNear(true)
    }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const live = near && failedSlug !== slug && hasWebGL()

  return (
    <div
      ref={box}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={cn('pointer-events-none relative aspect-[4/5]', className)}
      style={{ ...MASK, containerType: 'size', ...style }}
    >
      <ClubImage
        slug={slug}
        style={poster(zoom)}
        className={cn(
          'absolute top-[56%] left-1/2 aspect-[4/5] h-auto max-w-none object-contain transition-opacity duration-[600ms] ease-out',
          ready && 'opacity-0',
        )}
      />
      {live && (
        <div className={cn('absolute inset-0 transition-opacity duration-[900ms] ease-out', ready ? 'opacity-100' : 'opacity-0')}>
          <Suspense fallback={null}>
            <ClubShowcase
              slug={slug}
              moving={moving && inView && !still}
              follow={follow}
              zoom={zoom}
              onReady={() => setReadySlug(slug)}
              onError={() => setFailedSlug(slug)}
            />
          </Suspense>
        </div>
      )}
    </div>
  )
}
