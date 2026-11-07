import { lazy, Suspense } from 'react'
import type { components } from '@/api/schema.gen'
import { hasFlag } from '@/lib/flags'
import { useSession } from '@/store/session'
import { FlightSvg, flightTwoHeads } from '../flight'
import type { CameraPresetName, ClubPart, ClubStageProps } from '../stage3d'

// Lazy so the chat renders before three.js loads.
const ClubStage = lazy(() => import('../stage3d'))
const ClubRow = lazy(() => import('../stage3d').then((m) => ({ default: m.ClubRow })))

type Part = NonNullable<components['schemas']['StageEvent']['part']>
type Spec = components['schemas']['Spec']

const FOCUS: Record<Part, { focus: CameraPresetName; highlight: ClubPart }> = {
  head: { focus: 'headFace', highlight: 'head' },
  purchase: { focus: 'headFace', highlight: 'head' },
  handedness: { focus: 'headFace', highlight: 'head' },
  lie: { focus: 'addressDTL', highlight: 'head' },
  length: { focus: 'shaft', highlight: 'shaft' },
  flex: { focus: 'shaft', highlight: 'shaft' },
  material: { focus: 'shaft', highlight: 'shaft' },
  shaft_model: { focus: 'shaft', highlight: 'shaft' },
  grip: { focus: 'grip', highlight: 'grip' },
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function specProps(spec: Spec): ClubStageProps {
  return {
    head: spec.head,
    handedness: spec.handedness,
    shaftMaterial: spec.material,
    length: clamp(spec.length_in, -1.5, 1.5), // already a delta from standard (pack length_for)
    lie: spec.lie_deg,
    grip: spec.grip,
  }
}

/** Left stage: follows SSE `stage` events (focus_part, set_spec, show_flight, show_row). */
export function StagePanel() {
  const stage = useSession((s) => s.stage)
  const best = useSession((s) => s.state?.best ?? null)
  const setView = (view: 'club' | 'flight') => useSession.setState((s) => ({ stage: { ...s.stage, view } }))

  const spec = stage.spec ?? best
  const f = stage.focus ? FOCUS[stage.focus] : null
  const tab = (v: 'club' | 'flight', label: string) => (
    <button
      type="button"
      onClick={() => setView(v)}
      className={`rounded px-3 py-1 font-display text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${stage.view === v ? 'bg-surface-dark-3 text-washed-white' : 'text-ink-300 hover:text-washed-white'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 p-2">{tab('club', 'Club')}{tab('flight', 'Flight')}</div>
      <div className="min-h-0 flex-1">
        <Suspense fallback={<p className="p-4 text-ink-300">Loading stage...</p>}>
          {stage.view === 'flight' ? (
            hasFlag('flight-fixture') ? (
              <div className="p-4">
                <p className="mb-2 text-xs text-ink-300">Example flight</p>
                <FlightSvg data={flightTwoHeads} recommendedSlug={spec?.head} />
              </div>
            ) : (
              <p className="m-4 rounded border border-border-dark bg-surface-dark-2 p-4 text-sm text-ink-300">
                Ball flight shows here after the fit.
              </p>
            )
          ) : stage.view === 'row' ? (
            <ClubRow best={(spec?.head ?? stage.heads?.[0] ?? '201-mkii') as never} heads={stage.heads as never} />
          ) : (
            <ClubStage {...(spec ? specProps(spec) : {})} focus={f?.focus} highlight={f?.highlight} />
          )}
        </Suspense>
      </div>
    </div>
  )
}
