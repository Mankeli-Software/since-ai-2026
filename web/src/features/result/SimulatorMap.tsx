import { cardCls, eyebrowCls } from '../genui/ui'
import sims from '../../../../fixtures/simulators.json'

type Sim = { name: string; city: string; kind: string; has_takomo_test_clubs: boolean; example: boolean; map_x: number; map_y: number }
const all = sims as Record<string, Sim>

// Rough hand-drawn Finland outline in a 100x160 box.
const OUTLINE =
  '38,150 22,138 26,120 18,104 24,84 20,66 28,44 36,26 46,8 54,16 52,34 62,46 66,64 60,82 68,98 64,120 56,138 48,150'

export function SimulatorMapView({ ids }: { ids: string[] }) {
  const list = ids.map((id) => [id, all[id]] as const).filter(([, s]) => s)
  if (list.length === 0) return null
  return (
    <section className={`${cardCls} flex-row gap-6`}>
      <svg viewBox="0 0 100 160" className="h-56 shrink-0" role="img" aria-label="Map of Finland">
        <polygon points={OUTLINE} className="fill-ink-100 stroke-ink-300" strokeWidth="1" />
        {list.map(([id, s]) => (
          <circle key={id} cx={s.map_x * 100} cy={s.map_y * 160} r="3" className="fill-tiger-orange stroke-ink-900" strokeWidth="0.8" />
        ))}
      </svg>
      <ul className="flex flex-1 flex-col divide-y divide-border">
        {list.map(([id, s]) => (
          <li key={id} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
            <span className="font-display text-xl font-semibold uppercase leading-none">{s.name}</span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-500">
              {s.city} · {s.kind === 'simulator' ? 'Simulator' : 'Fitting studio'}
              {s.example && <span className={`${eyebrowCls} rounded-sm border border-border px-1.5 py-px`}>Example</span>}
              {s.has_takomo_test_clubs && <span className="rounded-sm bg-orange-100 px-1.5 py-px font-display text-xs font-semibold uppercase tracking-[0.12em] text-orange-ink">Takomo test clubs</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
