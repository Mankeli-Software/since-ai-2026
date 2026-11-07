/**
 * Takomo logo mark (spec §1.6), viewBox 0 0 40 36. `size` is the width; the height keeps the 40:36 ratio.
 * Sizes: 34 header, 30 K header, 24/20/16 inside the 44/36/28 avatars. Decorative unless `title` is given.
 */
export interface LogoMarkProps {
  size?: number
  color?: string
  title?: string
  className?: string
}

export function LogoMark({ size = 34, color = '#F8F8F8', title, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={Math.round((size * 36) / 40)}
      viewBox="0 0 40 36"
      fill="none"
      stroke={color}
      strokeWidth={3.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path d="M3 15 C 14 13 26 8 38 3" />
      <path d="M27 2 L 14.5 33" />
      <path d="M3 15 C 10 16 14 22 14.5 33" />
    </svg>
  )
}
