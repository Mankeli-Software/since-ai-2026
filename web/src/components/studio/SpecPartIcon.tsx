/** Spec-part icons (spec §1.6): 20px, stroke 1.6, round caps. Active = #FF6E01, others #C8C8C8. Decorative. */
export type SpecPart = 'head' | 'shaft' | 'length' | 'lie' | 'grip'

export interface SpecPartIconProps {
  part: SpecPart
  active?: boolean
  size?: number
  /** Overrides the active/inactive colour. */
  color?: string
  className?: string
}

function Paths({ part }: { part: SpecPart }) {
  switch (part) {
    case 'head':
      return <path d="M3 15 Q3 9 9 8.5 L19 11 L21 5 M19 11 L18 17 L6 17 Q3 17 3 15 Z" />
    case 'shaft':
      return (
        <>
          <path d="M5 20 L19 4" />
          <path d="M9.5 15.5 L12.5 12.5" strokeWidth={4} />
        </>
      )
    case 'length':
      return <path d="M3 12 H21 M3 12 l3 -3 M3 12 l3 3 M21 12 l-3 -3 M21 12 l-3 3 M8 9 V15 M12 9.5 V14.5 M16 9 V15" />
    case 'lie':
      return (
        <>
          <path d="M3 20 H21 M7 20 L17 4" />
          <path d="M12 20 A5 5 0 0 0 10.3 16.2" />
        </>
      )
    case 'grip':
      return (
        <>
          <rect x="8" y="3" width="8" height="18" rx="3" />
          <path d="M8 8 H16 M8 12 H16 M8 16 H16" />
        </>
      )
  }
}

export function SpecPartIcon({ part, active = false, size = 20, color, className }: SpecPartIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? (active ? 'var(--color-tiger-orange,#FF6E01)' : 'var(--color-grey-c8,#C8C8C8)')}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <Paths part={part} />
    </svg>
  )
}
