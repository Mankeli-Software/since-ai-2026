import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import type { components } from '@/api/schema.gen'
import { hasFlag } from '@/lib/flags'
import { useSession } from '@/store/session'
import { FlightSvg, flightTwoHeads } from '../flight'
import type { CameraPresetName, ClubPart, ClubStageHandle, ClubStageProps } from '../stage3d'
import { TinkerPanel, useTinker } from '../tinker'

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
  const lengthOffset = spec.length_in > 20 ? spec.length_in - 37 : spec.length_in
  return {
    head: spec.head,
    handedness: spec.handedness,
    shaftMaterial: spec.material,
    length: clamp(lengthOffset, -1.5, 1.5),
    lie: spec.lie_deg,
    grip: spec.grip,
  }
}

/** Left stage: follows SSE `stage` events (focus_part, set_spec, show_flight, show_row) + live Tinker. */
export function StagePanel() {
  const stage = useSession((s) => s.stage)
  const best = useSession((s) => s.state?.best ?? null)
  const setView = (view: 'club' | 'flight') => useSession.setState((s) => ({ stage: { ...s.stage, view } }))

  const [tinkerOpen, setTinkerOpen] = useState(false)
  const stageRef = useRef<ClubStageHandle>(null)

  const baselineSpec = best ?? stage.spec
  const tinker = useTinker(baselineSpec)

  const activeSpec = tinker.activeSpec
  const isTinkered = tinker.isTinkered

  const f = stage.focus ? FOCUS[stage.focus] : null

  const ghostProps = useMemo(() => {
    if (!isTinkered || !tinker.baseline) return null
    const len = tinker.baseline.length_in > 20 ? tinker.baseline.length_in - 37 : tinker.baseline.length_in
    return {
      length: clamp(len, -1.5, 1.5),
      lie: tinker.baseline.lie_deg,
      grip: tinker.baseline.grip,
      shaftMaterial: tinker.baseline.material,
    }
  }, [isTinkered, tinker.baseline])

  const flightData = useMemo(() => {
    if (tinker.tinkerResult?.flight_rec && tinker.tinkerResult?.flight_ours) {
      return {
        per_head: [
          { ...tinker.tinkerResult.flight_rec, recommended: true, label: `Rec: ${tinker.baseline.head}` },
          { ...tinker.tinkerResult.flight_ours, recommended: false, label: `Tinker: ${activeSpec.head}` },
        ],
      }
    }
    return null
  }, [tinker.tinkerResult, tinker.baseline.head, activeSpec.head])

  const tab = (v: 'club' | 'flight', label: string) => (
    <button
      type="button"
      onClick={() => setView(v)}
      className={`rounded px-3 py-1 font-display text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
        stage.view === v ? 'bg-surface-dark-3 text-washed-white' : 'text-ink-300 hover:text-washed-white'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div data-surface="dark" className="flex h-full flex-col">
      {/* Top Bar with Stage Views & Tinker Toggle */}
      <div className="flex items-center justify-between border-b border-border-dark p-2">
        <div className="flex gap-1">
          {tab('club', 'Club')}
          {tab('flight', 'Flight')}
        </div>

        <button
          type="button"
          onClick={() => setTinkerOpen((prev) => !prev)}
          className={`flex items-center gap-1.5 rounded px-3 py-1 font-display text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
            tinkerOpen
              ? 'bg-tiger-orange text-midnight-black'
              : isTinkered
                ? 'border border-tiger-orange bg-tiger-orange/15 text-tiger-orange hover:bg-tiger-orange/25'
                : 'bg-surface-dark-3 text-ink-300 hover:text-washed-white'
          }`}
        >
          <span>{tinkerOpen ? 'Close Tinker' : 'Tinker & Test'}</span>
          {isTinkered && !tinkerOpen && (
            <span className="h-1.5 w-1.5 rounded-full bg-tiger-orange" title="Custom overrides active" />
          )}
        </button>
      </div>

      {/* Main Stage: 3D Club or Ball Flight */}
      <div className="min-h-0 flex-1 relative flex flex-col">
        <div className="min-h-0 flex-1 relative">
          <Suspense fallback={<p className="p-4 text-ink-300">Setting up the bay...</p>}>
            {stage.view === 'flight' ? (
              flightData ? (
                <div className="p-4 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-ink-300">
                      Simulated Flight Compare
                    </p>
                    <span className="text-[11px] text-tiger-orange font-semibold">
                      Orange = Fitter's pick · White = Tinkered
                    </span>
                  </div>
                  <FlightSvg data={flightData} recommendedSlug={tinker.baseline.head} />
                </div>
              ) : hasFlag('flight-fixture') ? (
                <div className="p-4">
                  <p className="mb-2 text-xs text-ink-300">Simulated flight preview</p>
                  <FlightSvg data={flightTwoHeads} recommendedSlug={activeSpec?.head} />
                </div>
              ) : (
                <p className="m-4 rounded border border-border-dark bg-surface-dark-2 p-4 text-sm text-ink-300">
                  Your 3D ball flight and dispersion will map out here once we dial in your specs.
                </p>
              )
            ) : stage.view === 'row' ? (
              <ClubRow best={(activeSpec?.head ?? stage.heads?.[0] ?? '201-mkii') as never} heads={stage.heads as never} />
            ) : (
              <ClubStage
                ref={stageRef}
                {...(activeSpec ? specProps(activeSpec) : {})}
                ghost={ghostProps}
                focus={f?.focus}
                highlight={f?.highlight}
              />
            )}
          </Suspense>
        </div>

        {/* Collapsible / Drawer Tinker Panel */}
        {tinkerOpen && (
          <div className="h-[48%] min-h-[260px] max-h-[500px] border-t border-border-dark bg-surface-dark/95 backdrop-blur-md overflow-y-auto p-4 transition-all">
            <TinkerPanel
              stageRef={stageRef}
              baseline={tinker.baseline}
              overrides={tinker.overrides}
              tinkerResult={tinker.tinkerResult}
              isTinkered={tinker.isTinkered}
              loading={tinker.loading}
              onUpdateOverride={tinker.updateOverride}
              onReset={tinker.resetToRecommended}
            />
          </div>
        )}
      </div>
    </div>
  )
}
