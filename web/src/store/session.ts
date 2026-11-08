import { create } from 'zustand'
import { api, type FittingState, type MascotMood, type StreamEvent, type UIBlock } from '@/api/client'
import type { components } from '@/api/schema.gen'
import { streamTurn } from '@/api/stream'
import { GREETING, OPENING_BLOCK, OPENING_ID } from './opening'

type Schemas = components['schemas']

export interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  text: string
  /** Arrival order across messages and ui items (the chat timeline sorts on it). */
  seq: number
  /** True for messages that arrived live in this session; false or omitted for restored messages. */
  live?: boolean
}
export interface UiItem {
  id: string
  block: UIBlock
  interactive: boolean
  answered: boolean
  seq: number
  /** What the golfer sent back; blocks render read-only with it. */
  answer?: { value: unknown; displayText: string }
}

export interface StageState {
  view: 'club' | 'flight' | 'row'
  focus: NonNullable<Schemas['StageEvent']['part']> | null
  spec: Schemas['Spec'] | null
  heads: string[] | null
}
const EMPTY_STAGE: StageState = { view: 'club', focus: null, spec: null, heads: null }

let seqCounter = 0
const nextSeq = () => ++seqCounter

/** The in-flight `start()`. React StrictMode runs the Studio mount effect twice in dev; without this the second
 *  session replaced `sessionId` while the opening turn's cards belonged to the first, so answers got 422 (#162).
 *  Only a start with the same arguments shares it; one with other arguments aborts it and starts afresh, so a
 *  quick switch of persona or engine ends on the last one asked for (#196). */
let starting: { key: string; promise: Promise<void>; abort: AbortController } | null = null
/** An own fitting's `start()` while it runs: its opening card is on screen before the session exists, so an
 *  early answer waits for the session and the opening turn. */
let opening: Promise<void> | null = null
/** The server's id for the opening card, from the opening turn. The local card keeps `OPENING_ID`. */
let openingId: string | null = null
/** Ids of client-only blocks from `addUi` (e.g. the header's Add data). The server never issued them, so answering
 *  one must not send a `ui_response` (the turn route rejects an unknown `component_id` with 422). */
const LOCAL_UI = 'local-ui-'
/** What the fitter says after a local Add data import when no import card of its own is waiting. The block already did
 *  the REST import + confirm and merged the new state, so no turn runs; the next turn's state digest carries the new
 *  evidence. No numbers here (invariant 14). */
const LOCAL_IMPORT_ACK = 'Got it, those shots are in. Your fit and fit confidence are updated.'

interface SessionStore {
  sessionId: string | null
  engine: 'scripted' | 'live' | null
  state: FittingState | null
  /** Set for persona sessions (L16): drives the "Simulated golfer" badge. */
  demo: string | null
  mascot: MascotMood
  /** What the left stage shows; driven by SSE `stage` events. */
  stage: StageState
  /** null = never tried; 'ok' = saved; 'unavailable' = the save endpoint is missing or failed. */
  saved: { status: 'ok' | 'unavailable'; resumeUrl?: string } | null
  messages: ChatMessage[]
  ui: UiItem[]
  busy: boolean
  error: string | null
  mode: 'chat' | 'form'
  setMode(mode: 'chat' | 'form'): void
  start(opts: { engine?: 'scripted' | 'live'; demo?: string | null }): Promise<void>
  resume(token: string): Promise<void>
  say(text: string): Promise<void>
  /** POST /api/sessions/{id}/save (plan §3.8). Optional email. */
  save(email?: string): Promise<void>
  respond(componentId: string, value: unknown, displayText: string): Promise<void>
  /** Keeps the FittingState with the highest `version`: call it for SSE `state` events and REST responses. */
  mergeState(next: FittingState): void
  addUi(block: UIBlock, interactive?: boolean): void
}

export const useSession = create<SessionStore>()((set, get) => {
  const apply = (ev: StreamEvent) => {
    switch (ev.type) {
      case 'text':
        set((s) => {
          const last = s.messages.at(-1)
          return last?.id === ev.msg_id
            ? { messages: [...s.messages.slice(0, -1), { ...last, text: last.text + ev.delta }] }
            : { messages: [...s.messages, { id: ev.msg_id, role: 'assistant', text: ev.delta, seq: nextSeq(), live: true }] }
        })
        break
      case 'ui':
        set((s) => ({ ui: [...s.ui, { id: ev.id, block: ev.block, interactive: ev.interactive, answered: false, seq: nextSeq() }] }))
        break
      case 'state':
        get().mergeState(ev.state)
        break
      case 'mascot':
        set({ mascot: ev.mood })
        break
      case 'stage':
        set((s) => {
          const st = s.stage
          switch (ev.action) {
            case 'focus_part':
              return { stage: { ...st, view: 'club', focus: ev.part ?? st.focus } }
            case 'set_spec':
              return { stage: { ...st, view: 'club', spec: ev.spec ?? st.spec } }
            case 'show_flight':
              return { stage: { ...st, view: 'flight', heads: ev.heads ?? st.heads } }
            case 'show_row':
              return { stage: { ...st, view: 'row', heads: ev.heads ?? st.heads } }
          }
        })
        break
      case 'error':
        set({ error: `${ev.code}: ${ev.message}` })
        break
      default: // turn_start, done: not used by the scaffold
    }
  }

  const turn = async (body: Parameters<typeof streamTurn>[1], signal?: AbortSignal) => {
    if (get().busy) return
    set({ busy: true, error: null })
    try {
      await opening
      const { sessionId } = get()
      if (!sessionId) return
      const msg = body.message
      if (msg.kind === 'ui_response' && msg.component_id === OPENING_ID && openingId) {
        body = { message: { ...msg, component_id: openingId } }
      }
      for await (const ev of streamTurn(sessionId, body, signal)) {
        if (signal?.aborted) break
        apply(ev)
      }
    } catch (e) {
      if (!signal?.aborted) set({ error: String(e) })
    } finally {
      set({ busy: false })
    }
  }

  /** The own fitting's opening turn. Its greeting is already on screen, and its card is the local one, so it only
   *  shows lines that are not the greeting (a notice). With no card from the server, the local one goes too. */
  const openingTurn = async (sessionId: string, signal: AbortSignal) => {
    const said = new Map<string, string>()
    try {
      for await (const ev of streamTurn(sessionId, { message: { kind: 'text', text: 'Hi' } }, signal)) {
        if (signal.aborted) return
        if (ev.type === 'text') said.set(ev.msg_id, (said.get(ev.msg_id) ?? '') + ev.delta)
        else if (ev.type === 'ui' && ev.block.type === 'sentence_builder' && !openingId) openingId = ev.id
        else apply(ev)
      }
    } catch (e) {
      if (!signal.aborted) set({ error: String(e) })
    }
    if (signal.aborted) return
    for (const [msg_id, delta] of said) {
      if (!GREETING.includes(delta.trim())) apply({ type: 'text', seq: 0, msg_id, delta })
    }
    if (!openingId) set((s) => ({ ui: s.ui.filter((u) => u.id !== OPENING_ID) }))
  }

  /** A superseded start (`signal` aborted) leaves the store to the newer one. */
  const startSession = async ({ engine, demo }: Parameters<SessionStore['start']>[0], signal: AbortSignal) => {
    openingId = null
    if (demo) {
      set({ messages: [], ui: [] }) // a superseded own fitting may have put its opening on screen
    } else {
      // No model or tool is needed for the first step, so it shows at once (store/opening.ts).
      set({
        messages: GREETING.map((text, i) => ({ id: `opening-m${i}`, role: 'assistant', text, seq: nextSeq(), live: true })),
        ui: [{ id: OPENING_ID, block: OPENING_BLOCK, interactive: true, answered: false, seq: nextSeq() }],
      })
    }
    let res
    try {
      res = await api.POST('/api/sessions', {
        body: { engine: engine ?? null, demo_golfer_id: demo ?? null, host: { platform: 'standalone' } },
        signal,
      })
    } catch (e) {
      if (signal.aborted) return
      throw e
    }
    if (signal.aborted) return
    const { data, error } = res
    if (!data) {
      set({ error: `session failed: ${JSON.stringify(error)}` })
      return
    }
    set({ sessionId: data.session_id, engine: engine ?? null, state: null, demo: demo ?? null, stage: EMPTY_STAGE })
    if (data.notice?.fallback === 'form') {
      set({ mode: 'form' })
    }
    get().mergeState(data.state)
    // A turn needs a message: a hidden "Hi" opens the scripted/live conversation.
    if (demo) await turn({ message: { kind: 'text', text: 'Hi' } }, signal)
    else await openingTurn(data.session_id, signal)
  }

  return {
    sessionId: null,
    engine: null,
    state: null,
    demo: null,
    mascot: 'idle',
    stage: EMPTY_STAGE,
    saved: null,
    messages: [],
    ui: [],
    busy: false,
    error: null,
    mode: 'chat',
    setMode: (mode) => set({ mode }),
    mergeState: (next) => set((s) => (!s.state || next.version > s.state.version ? { state: next } : {})),
    start(opts) {
      const key = `${opts.engine ?? ''}|${opts.demo ?? ''}`
      if (starting?.key === key) return starting.promise
      starting?.abort.abort()
      const abort = new AbortController()
      const promise: Promise<void> = startSession(opts, abort.signal).finally(() => {
        if (starting?.abort === abort) starting = opening = null
      })
      starting = { key, promise, abort }
      opening = opts.demo ? null : promise
      return promise
    },
    async resume(token: string) {
      set({ busy: true, error: null })
      try {
        const r = await fetch(`/api/resume/${token}`)
        if (!r.ok) throw new Error(String(r.status))
        const data = (await r.json()) as {
          session_id: string
          demo_golfer_id: string | null
          engine: 'scripted' | 'live'
          state: FittingState
        }
        set({
          sessionId: data.session_id,
          engine: data.engine,
          demo: data.demo_golfer_id ?? null,
          stage: EMPTY_STAGE,
        })
        get().mergeState(data.state)

        const sessRes = await fetch(`/api/sessions/${data.session_id}`)
        if (sessRes.ok) {
          const sessData = (await sessRes.json()) as {
            transcript?: Array<{ turn_no: number; role: 'assistant' | 'user'; text: string }>
            blocks?: Array<{
              id: string
              block: UIBlock
              interactive: boolean
              answer?: { value: unknown; display_text: string } | null
              turn_no?: number | null
            }>
          }
          // Messages and the cards that were shown, in one timeline (#216): a turn's cards follow its last message.
          type Row = { turn: number; card: 0 | 1; m?: ChatMessage; u?: UiItem }
          const rows: Row[] = [
            // The hidden "Hi" that opens every session is not the golfer's message.
            ...(sessData.transcript ?? []).filter((t, idx) => !(idx === 0 && t.role === 'user' && t.text === 'Hi')).map((t, idx): Row => ({
              turn: t.turn_no,
              card: 0,
              m: { id: `t-${t.turn_no}-${idx}`, role: t.role, text: t.text, seq: 0 },
            })),
            ...(sessData.blocks ?? []).map((b): Row => ({
              turn: b.turn_no ?? Number.MAX_SAFE_INTEGER,
              card: 1,
              u: {
                id: b.id,
                block: b.block,
                interactive: b.interactive,
                answered: b.answer != null,
                seq: 0,
                answer: b.answer ? { value: b.answer.value, displayText: b.answer.display_text } : undefined,
              },
            })),
          ].sort((a, b) => a.turn - b.turn || a.card - b.card)
          const messages: ChatMessage[] = []
          const ui: UiItem[] = []
          for (const r of rows) {
            if (r.m) messages.push({ ...r.m, seq: nextSeq() })
            if (r.u) ui.push({ ...r.u, seq: nextSeq() })
          }
          if (messages.length > 0 || ui.length > 0) set({ messages, ui })
        }
      } catch (e) {
        set({ error: `resume failed: ${String(e)}` })
      } finally {
        set({ busy: false })
      }
    },
    async save(email?: string) {
      const { sessionId } = get()
      if (!sessionId) return
      try {
        const r = await fetch(`/api/sessions/${sessionId}/save`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: email || null }),
        })
        if (!r.ok) throw new Error(String(r.status))
        const j = (await r.json()) as { resume_url?: string }
        set({ saved: { status: 'ok', resumeUrl: j.resume_url } })
      } catch {
        set({ saved: { status: 'unavailable' } })
      }
    },
    say: (text) => {
      // Typed text while an input block waits also answers it on the server (agent/engines/base.py answer_of).
      set((s) => ({
        ui: s.ui.map((u) => (u.interactive && !u.answered ? { ...u, answered: true, answer: { value: text, displayText: text } } : u)),
        messages: [...s.messages, { id: `u-${s.messages.length}`, role: 'user', text, seq: nextSeq() }],
      }))
      return turn({ message: { kind: 'text', text } })
    },
    respond(componentId, value, displayText) {
      set((s) => ({
        ui: s.ui.map((u) => (u.id === componentId ? { ...u, answered: true, answer: { value, displayText } } : u)),
        messages: [...s.messages, { id: `u-${s.messages.length}`, role: 'user', text: displayText, seq: nextSeq() }],
      }))
      if (componentId.startsWith(LOCAL_UI)) {
        // A local block does its own REST work; a skip just closes it.
        const imported = typeof value === 'object' && value !== null && 'import_id' in value
        if (!imported) return Promise.resolve()
        // If the fitter is itself waiting on an import card, that import answers it (with the server's id), so the
        // conversation moves on instead of asking for the same shots again.
        const waiting = [...get().ui]
          .reverse()
          .find((u) => u.interactive && !u.answered && !u.id.startsWith(LOCAL_UI) && u.block.type === 'data_import')
        if (waiting) {
          set((s) => ({ ui: s.ui.map((u) => (u.id === waiting.id ? { ...u, answered: true, answer: { value, displayText } } : u)) }))
          return turn({ message: { kind: 'ui_response', component_id: waiting.id, value, display_text: displayText } })
        }
        set((s) => ({
          messages: [...s.messages, { id: `${componentId}-ack`, role: 'assistant', text: LOCAL_IMPORT_ACK, seq: nextSeq() }],
        }))
        return Promise.resolve()
      }
      return turn({ message: { kind: 'ui_response', component_id: componentId, value, display_text: displayText } })
    },
    addUi(block, interactive = true) {
      const id = `${LOCAL_UI}${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      set((s) => ({ ui: [...s.ui, { id, block, interactive, answered: false, seq: nextSeq() }] }))
    },
  }
})
