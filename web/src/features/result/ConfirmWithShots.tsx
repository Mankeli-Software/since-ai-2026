import { Button, Eyebrow } from '@/components/studio'
import { useSession } from '@/store/session'
import sims from '../../../../fixtures/simulators.json'
import { CONFIRM_COPY } from './fixtures/commerce'

type Sim = { name: string; city: string; kind: string; has_takomo_test_clubs: boolean; example: boolean }
const all = sims as Record<string, Sim>

/** Default list when no simulator_map block arrived: the example venues that have Takomo test clubs. */
const DEFAULT_IDS = Object.entries(all)
  .filter(([, s]) => s.has_takomo_test_clubs)
  .map(([id]) => id)

// Decorative pin spots on the illustrative street map (mockup R1b). The list carries the real names.
const PINS: [number, number][] = [
  [212, 34],
  [96, 92],
  [262, 104],
]

const pct = (x: number) => Math.round(x * 100)

/**
 * R1b "Confirm it with real shots" (spec §3 R1b): street map + venue list, the ask, a projected-confidence bar
 * (now → ~92%, striped part = example projection), Save fit and pick a simulator, Just save it.
 * Buying is never blocked: this only lives in the aside.
 */
export function ConfirmWithShots({ confidence, simulatorIds }: { confidence: number | null; simulatorIds?: string[] | null }) {
  const save = useSession((s) => s.save)
  const saved = useSession((s) => s.saved)
  const sessionId = useSession((s) => s.sessionId)
  const list = (simulatorIds?.length ? simulatorIds : DEFAULT_IDS)
    .map((id) => [id, all[id]] as const)
    .filter(([, s]) => s)
    .slice(0, 3)

  const now = confidence ?? 0
  const gain = useSession((s) => s.state?.next_question?.expected_gain ?? null)
  const projected = gain != null ? Math.min(1, now + gain) : null

  return (
    <section
      aria-label="Confirm your fit in a simulator"
      className="flex flex-col gap-3 rounded-14 border border-grey-2a bg-grey-12 p-4"
    >
      <Eyebrow className="text-orange-hover">Confirm it with real shots</Eyebrow>
      <svg viewBox="0 0 330 130" className="block w-full rounded-10 bg-grey-16" aria-hidden="true">
        <g stroke="#262626" strokeWidth="6" fill="none" strokeLinecap="round">
          <path d="M-10 70 C 80 60 160 90 340 50" />
          <path d="M150 -10 C 160 40 140 90 170 140" />
        </g>
        <g stroke="#1F1F1F" strokeWidth="3" fill="none">
          <path d="M40 -10 L60 140 M250 -10 L230 140 M-10 20 L340 30" />
        </g>
        <circle cx="160" cy="70" r="7" fill="#F8F8F8" />
        <circle cx="160" cy="70" r="14" fill="#F8F8F8" fillOpacity=".15" />
        {list.map(([id], i) => (
          <g key={id}>
            <circle cx={PINS[i][0]} cy={PINS[i][1]} r="11" fill="#FF6E01" />
            <text
              x={PINS[i][0]}
              y={PINS[i][1] + 4}
              textAnchor="middle"
              fontFamily="Barlow Condensed"
              fontWeight="700"
              fontSize="13"
              fill="#0B0B0B"
            >
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      <ol className="m-0 list-none p-0">
        {list.map(([id, s], i) => (
          <li key={id} className="flex items-center gap-2.5 border-t border-grey-26 py-[7px]">
            <span className="inline-flex size-5 flex-none items-center justify-center rounded-full bg-tiger-orange font-display text-[12px] font-bold text-midnight">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px]">{s.name}</span>
            <span className="flex-none text-[13px] text-grey-a3">{s.city}</span>
          </li>
        ))}
      </ol>
      <span className="text-[14px] leading-[1.45] text-grey-c8">{CONFIRM_COPY}</span>
      <div
        className="flex items-center gap-2.5"
        role="img"
        aria-label={
          projected != null
            ? `Fit confidence ${pct(now)} percent now, about ${pct(projected)} percent with real shots`
            : `Fit confidence ${pct(now)} percent now`
        }
      >
        <span className="font-display text-[18px] font-bold tabular-nums text-grey-a3">{pct(now)}%</span>
        <div className="relative h-1.5 flex-1 rounded-[3px] bg-grey-26">
          <div className="absolute inset-y-0 left-0 rounded-[3px] bg-tiger-orange" style={{ width: `${pct(now)}%` }} />
          {projected != null && (
            <div
              className="absolute inset-y-0 rounded-r-[3px] opacity-60"
              style={{
                left: `${pct(now)}%`,
                width: `${pct(projected) - pct(now)}%`,
                background: 'repeating-linear-gradient(90deg,#FF6E01 0 4px,transparent 4px 7px)',
              }}
            />
          )}
        </div>
        {projected != null && (
          <span className="font-display text-[18px] font-bold tabular-nums">~{pct(projected)}%</span>
        )}
      </div>
      <Button variant="lightOnDark" className="min-h-[46px] text-[17px]" disabled={!sessionId} onClick={() => void save()}>
        Save fit and pick a simulator
      </Button>
      <button
        type="button"
        disabled={!sessionId}
        onClick={() => void save()}
        className="cursor-pointer self-center border-0 bg-transparent text-[14px] text-washed-white underline transition-ui hover:text-orange-hover disabled:cursor-default disabled:opacity-50"
      >
        Just save it to myTakomo
      </button>
      {saved && (
        <span role="status" className="self-center text-[13px] text-grey-a3">
          {saved.status === 'ok' ? 'Saved to myTakomo.' : 'Saving is not ready yet.'}
        </span>
      )}
    </section>
  )
}
