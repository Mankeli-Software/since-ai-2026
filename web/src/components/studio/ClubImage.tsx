import { useState, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'

/** Image files per head in `assets/clubs/images/<slug>/` (served at /assets/clubs in dev and in the build). */
export type ClubImageVariant =
  | 'hero'
  | 'hero_back'
  | 'address'
  | 'back'
  | 'face'
  | 'sole'
  | 'render_hero'
  | 'render_address'
  | 'render_back'
  | 'render_face'
  | 'render_sole'

export interface ClubImageProps {
  /** Head slug as in assets/clubs/manifest.json, e.g. '201t-mkii'. */
  slug: string
  variant?: ClubImageVariant
  /** Empty string (default) = decorative. Pass a real alt when the image carries meaning. */
  alt?: string
  className?: string
  style?: CSSProperties
}

export function clubImageSrc(slug: string, variant: ClubImageVariant = 'hero') {
  return `/assets/clubs/images/${encodeURIComponent(slug)}/${variant}.webp`
}

/** Transparent product cut-out. Falls back to a neutral placeholder when the file is missing. */
export function ClubImage({ slug, variant = 'hero', alt = '', className, style }: ClubImageProps) {
  const src = clubImageSrc(slug, variant)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (failedSrc === src) {
    return (
      <span
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        style={style}
        className={cn(
          'inline-flex aspect-square items-center justify-center rounded-12 bg-grey-1a text-grey-5f',
          className,
        )}
      >
        {/* Generic iron silhouette: shaft + head. */}
        <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 2 L9.5 17" />
          <path d="M9.5 17 L4 18.5 Q3 19.5 4 20.5 L11 20.5 Q12 20.5 12 19.5 L11.5 16.5 Z" />
        </svg>
      </span>
    )
  }
  return <img src={src} alt={alt} style={style} className={className} onError={() => setFailedSrc(src)} draggable={false} />
}
