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
    <section className="flex gap-4 rounded-lg border border-border bg-background p-4">
      <svg viewBox="0 0 100 160" className="h-56 shrink-0" role="img" aria-label="Map of Finland">
        <polygon points={OUTLINE} className="fill-secondary stroke-border" strokeWidth="1" />
        {list.map(([id, s]) => (
          <circle key={id} cx={s.map_x * 100} cy={s.map_y * 160} r="3" className="fill-accent stroke-primary" strokeWidth="0.8" />
        ))}
      </svg>
      <ul className="flex flex-col gap-2 text-sm">
        {list.map(([id, s]) => (
          <li key={id} className="flex flex-col">
            <span className="font-medium">{s.name}</span>
            <span className="text-xs text-muted-foreground">
              {s.city} · {s.kind === 'simulator' ? 'Simulator' : 'Fitting studio'}
              {s.example && <span className="ml-1 rounded border border-border px-1">Example</span>}
              {s.has_takomo_test_clubs && <span className="ml-1 rounded bg-accent px-1 text-accent-foreground">Takomo test clubs</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
