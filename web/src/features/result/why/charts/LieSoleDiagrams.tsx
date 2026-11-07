import { cn } from '@/lib/utils'
import { ChartPanel } from './ChartPanel'

type State = 'flat' | 'neutral' | 'upright'

/** Sole tilt in the drawing (illustration only, not a measured angle). */
const TILT: Record<State, number> = { flat: 4, neutral: 0, upright: -4 }

const stateOf = (lie: number): State => (lie < 0 ? 'flat' : lie > 0 ? 'upright' : 'neutral')

/** Labels carry your degrees only on your state; the others name the state without a number. */
function label(s: State, lie: number) {
  const deg = Math.abs(lie)
  if (s === 'neutral') return '0°, sole flat'
  if (s === 'flat') return stateOf(lie) === 'flat' ? `${deg}° flat, toe down` : 'Flat, toe down'
  return stateOf(lie) === 'upright' ? `${deg}° up, toe up` : 'Upright, toe up'
}

function Sole({ tilt, yours }: { tilt: number; yours: boolean }) {
  return (
    <svg viewBox="0 0 120 60" className="w-[110px] max-w-full" aria-hidden="true">
      <line x1="6" y1="50" x2="114" y2="50" stroke="#3D3D3D" strokeWidth="2" />
      <g transform={`rotate(${tilt} 60 46)`}>
        <path d="M18 42 Q18 30 36 28 L100 36 Q106 50 92 52 L26 52 Q16 52 18 42 Z" fill={yours ? '#F8F8F8' : '#8F8F8F'} />
      </g>
    </svg>
  )
}

/** R2 lie: how the sole meets the ground at impact, three states, yours highlighted from `lie_deg`. */
export function LieSoleDiagrams({ lie }: { lie: number }) {
  const yours = stateOf(lie)
  return (
    <ChartPanel title="How the sole meets the ground at impact">
      <ul className="m-0 flex list-none gap-2.5 p-0">
        {(['flat', 'neutral', 'upright'] as const).map((s) => {
          const on = s === yours
          return (
            <li
              key={s}
              aria-current={on ? 'true' : undefined}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center gap-2 rounded-12 px-2 py-3 text-center',
                on ? 'bg-[rgba(255,110,1,0.12)] shadow-[inset_0_0_0_1.5px_#FF6E01]' : 'bg-grey-1a',
              )}
            >
              <Sole tilt={TILT[s]} yours={on} />
              <span className={cn('font-display text-[18px] leading-tight font-bold max-[1400px]:text-[16px]', on ? 'text-orange-hover' : 'text-grey-c8')}>
                {label(s, lie)}
                {on && <span className="sr-only"> (yours)</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </ChartPanel>
  )
}
