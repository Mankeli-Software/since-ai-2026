import type { MascotMood } from '@/api/client'

const MOUTH: Record<MascotMood, string> = {
  idle: 'M11 23 H21',
  thinking: 'M12 23 H19',
  talking: 'M12 22 Q16 26 20 22 Z',
  happy: 'M11 22 Q16 27 21 22',
  surprised: 'M16 21 a2 2.5 0 1 0 0.01 0',
}

/** SVG placeholder (L9): a plain golf-ball face. The Rive mascot is a FLOATER task. */
export function Mascot({ mood = 'idle', className }: { mood?: MascotMood; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label={`Fitter mascot, ${mood}`} className={className}>
      <circle cx="16" cy="16" r="14" fill="#f8f8f8" stroke="#0b0b0b" strokeWidth="2" />
      <g fill="#0b0b0b">
        <circle cx="11.5" cy={mood === 'thinking' ? 12 : 14} r={mood === 'surprised' ? 2 : 1.4} />
        <circle cx="20.5" cy={mood === 'thinking' ? 12 : 14} r={mood === 'surprised' ? 2 : 1.4} />
      </g>
      <path
        d={MOUTH[mood]}
        fill={mood === 'talking' || mood === 'surprised' ? '#0b0b0b' : 'none'}
        stroke="#0b0b0b"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {mood === 'thinking' && <circle cx="26" cy="5" r="2" fill="#ff6e01" />}
    </svg>
  )
}
