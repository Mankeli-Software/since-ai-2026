import { useMemo } from 'react'
import type { FittingState, UIBlock } from '@/api/client'
import { hasFlag } from '@/lib/flags'
import { useSession, type ChatMessage, type UiItem } from '@/store/session'
import type { BlockOf, BlockType } from '../genui/types'
import type { Spec } from './types'

/**
 * Everything the results screens read, from one place. Live: the session store (`state` plus the latest
 * block of each type in `ui`). Fixture preview: fixtures/ui/*.json plus a fake best/runner_up, no session.
 * Fixture mode is on with `?ff=results-fixture` (studio.html) or when the shell is told to (dev.html?ff=results).
 * Add `no-sim` to the flags to preview the R1b variant (`?ff=results,no-sim`).
 */
export interface ResultsData {
  source: 'live' | 'fixture'
  state: FittingState | null
  best: Spec | null
  runnerUp: Spec | null
  recommendation: BlockOf<'recommendation_card'> | null
  why: BlockOf<'why_panel'> | null
  compare: BlockOf<'club_compare'> | null
  /** The latest block of any type (close_call, flex_band, stock_vs_custom, simulator_map, …), or null. */
  latest: <T extends BlockType>(type: T) => BlockOf<T> | null
  /** The fitter's latest message text (plain text with **bold**), or null. */
  assistantText: string | null
  /** R1b: the fit is not confident yet, or no measured shots came in. Buying is never blocked by it. */
  noSim: boolean
}

// ---- fixture preview ----

const fixtureFiles = import.meta.glob<UIBlock>('@fixtures/ui/*.json', { eager: true, import: 'default' })
const fixtureBlocks = Object.values(fixtureFiles)

/** Fake best/runner_up for the preview: the design persona's fit (spec §3). Not a tool output. */
const FIXTURE_BEST: Spec = {
  head: '201t-mkii',
  shaft: 'kbs-tour-lite-regular',
  shaft_model: 'KBS Tour Lite',
  flex: 'regular',
  material: 'steel',
  length_in: 0,
  lie_deg: 0,
  grip: 'standard',
  handedness: 'right',
  purchase: 'stock',
}
const FIXTURE_RUNNER_UP: Spec = { ...FIXTURE_BEST, head: '201-mkii' }

function fixtureState(noSim: boolean): FittingState {
  return {
    version: 0,
    evidence_version: 0,
    gate: noSim ? 'provisional' : 'confident',
    confidence: noSim ? 0.68 : 0.82,
    best: FIXTURE_BEST,
    runner_up: FIXTURE_RUNNER_UP,
    import_ids: noSim ? [] : ['fixture-trackman'],
    missing: [],
    per_part: {},
  }
}

export const isFixtureFlag = () => hasFlag('results-fixture')

/** The store's FittingState for the header (confidence) in a session-less preview. Only fills an empty store. */
export function seedFixtureHeader() {
  const s = useSession.getState()
  if (!s.sessionId && !s.state) s.mergeState(fixtureState(hasFlag('no-sim')))
}

function latestIn(blocks: UIBlock[]) {
  return <T extends BlockType>(type: T): BlockOf<T> | null => {
    for (let i = blocks.length - 1; i >= 0; i--) if (blocks[i].type === type) return blocks[i] as BlockOf<T>
    return null
  }
}

function fixtureData(): ResultsData {
  const noSim = hasFlag('no-sim')
  const latest = latestIn(fixtureBlocks)
  return {
    source: 'fixture',
    state: fixtureState(noSim),
    best: FIXTURE_BEST,
    runnerUp: FIXTURE_RUNNER_UP,
    recommendation: latest('recommendation_card'),
    why: latest('why_panel'),
    compare: latest('club_compare'),
    latest,
    assistantText: null,
    noSim,
  }
}

// ---- live ----

function liveData(state: FittingState | null, ui: UiItem[], messages: ChatMessage[]): ResultsData {
  const latest = latestIn(ui.map((u) => u.block))
  const recommendation = latest('recommendation_card')
  let assistant: ChatMessage | undefined
  for (let i = messages.length - 1; i >= 0 && !assistant; i--) {
    if (messages[i].role === 'assistant' && messages[i].text.trim()) assistant = messages[i]
  }
  return {
    source: 'live',
    state,
    best: state?.best ?? recommendation?.spec ?? null,
    runnerUp: state?.runner_up ?? recommendation?.runner_up ?? null,
    recommendation,
    why: latest('why_panel'),
    compare: latest('club_compare'),
    latest,
    assistantText: assistant?.text ?? null,
    noSim: !state || state.gate !== 'confident' || (state.import_ids ?? []).length === 0,
  }
}

/** `fixture` forces the preview (dev.html); otherwise `?ff=results-fixture` decides. */
export function useResultsData(fixture = false): ResultsData {
  const useFixture = fixture || isFixtureFlag()
  const state = useSession((s) => s.state)
  const ui = useSession((s) => s.ui)
  const messages = useSession((s) => s.messages)
  return useMemo(
    () => (useFixture ? fixtureData() : liveData(state, ui, messages)),
    [useFixture, state, ui, messages],
  )
}
