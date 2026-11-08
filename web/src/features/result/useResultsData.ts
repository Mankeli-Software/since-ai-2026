import { useEffect, useMemo, useState } from 'react'
import { api, type FittingState, type UIBlock } from '@/api/client'
import { hasFlag } from '@/lib/flags'
import { useSession, type ChatMessage, type UiItem } from '@/store/session'
import type { BlockOf, BlockType } from '../genui/types'
import type { Spec } from './types'

export type WhyItem = BlockOf<'why_panel'>['items'][number]

/** All why items, the fitter's why_panel items first (newest block first), then the fit explanation. */
export function whyItems(data: ResultsData): WhyItem[] {
  return [...data.panelWhy, ...(data.fitWhy ?? [])]
}

const panelItems = (blocks: UIBlock[]): WhyItem[] =>
  blocks.flatMap((b) => (b.type === 'why_panel' ? [b.items] : [])).reverse().flat()

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
  /** Every why_panel item the fitter showed, newest block first (the agent's explain_part). */
  panelWhy: WhyItem[]
  /**
   * The deterministic fit explanation (`GET /api/sessions/{id}/fit` -> `why`, from explain_fit), so every part
   * has a reason even when the agent never called explain_part. Null until it loads, and in the fixture preview.
   */
  fitWhy: WhyItem[] | null
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
    panelWhy: panelItems(fixtureBlocks),
    fitWhy: null,
    compare: latest('club_compare'),
    latest,
    assistantText: null,
    noSim,
  }
}

// ---- live ----

function liveData(state: FittingState | null, ui: UiItem[], messages: ChatMessage[], fitWhy: WhyItem[] | null): ResultsData {
  const blocks = ui.map((u) => u.block)
  const latest = latestIn(blocks)
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
    panelWhy: panelItems(blocks),
    fitWhy,
    compare: latest('club_compare'),
    latest,
    assistantText: assistant?.text ?? null,
    noSim: !state || state.gate !== 'confident' || (state.import_ids ?? []).length === 0,
  }
}

/** Wait for the running turn to end (the fit endpoint answers 409 while a turn holds the session lock). */
function turnEnded(): Promise<void> {
  if (!useSession.getState().busy) return Promise.resolve()
  return new Promise((resolve) => {
    const off = useSession.subscribe((s) => {
      if (!s.busy) {
        off()
        resolve()
      }
    })
  })
}

const RETRY_MS = 1500

/**
 * `GET /api/sessions/{id}/fit` once per session, evidence version and best spec. On any failure it waits for
 * the turn to end, retries once, and otherwise keeps the text it had: never an error on the page.
 */
function useFitWhy(sessionId: string | null, evidenceVersion: number | null, best: Spec | null): WhyItem[] | null {
  const [fit, setFit] = useState<{ sessionId: string; items: WhyItem[] } | null>(null)
  const bestKey = best ? JSON.stringify(best) : null
  useEffect(() => {
    if (!sessionId || !bestKey) return
    let cancelled = false
    const load = async () => {
      const res = await api.GET('/api/sessions/{session_id}/fit', { params: { path: { session_id: sessionId } } })
      if (!res.data) throw new Error(`fit ${res.response.status}`)
      return res.data.why ?? []
    }
    const retry = async () => {
      await turnEnded()
      await new Promise((r) => setTimeout(r, RETRY_MS))
      if (cancelled) throw new Error('cancelled')
      return load()
    }
    load()
      .catch(retry)
      .then((items) => {
        if (!cancelled) setFit({ sessionId, items })
      })
      .catch(() => {
        // Keep the old text; the R2 parts fall back to "not explained yet" only when nothing ever loaded.
      })
    return () => {
      cancelled = true
    }
  }, [sessionId, evidenceVersion, bestKey])
  // A text from another session (persona switch) is never shown.
  return fit && fit.sessionId === sessionId ? fit.items : null
}

/** `fixture` forces the preview (dev.html); otherwise `?ff=results-fixture` decides. */
export function useResultsData(fixture = false): ResultsData {
  const useFixture = fixture || isFixtureFlag()
  const state = useSession((s) => s.state)
  const ui = useSession((s) => s.ui)
  const messages = useSession((s) => s.messages)
  const sessionId = useSession((s) => s.sessionId)
  const best = useFixture ? null : (state?.best ?? null)
  const fitWhy = useFitWhy(useFixture ? null : sessionId, state?.evidence_version ?? null, best)
  return useMemo(
    () => (useFixture ? fixtureData() : liveData(state, ui, messages, fitWhy)),
    [useFixture, state, ui, messages, fitWhy],
  )
}
