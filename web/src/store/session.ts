import { create } from 'zustand'
import { api, type FittingState, type StreamEvent, type UIBlock } from '@/api/client'
import { streamTurn } from '@/api/stream'

export interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  text: string
}
export interface UiItem {
  id: string
  block: UIBlock
  interactive: boolean
  answered: boolean
}

interface SessionStore {
  sessionId: string | null
  engine: 'scripted' | 'live' | null
  state: FittingState | null
  messages: ChatMessage[]
  ui: UiItem[]
  busy: boolean
  error: string | null
  start(opts: { engine?: 'scripted' | 'live'; demo?: string | null }): Promise<void>
  say(text: string): Promise<void>
  respond(componentId: string, value: unknown, displayText: string): Promise<void>
  /** Keeps the FittingState with the highest `version`: call it for SSE `state` events and REST responses. */
  mergeState(next: FittingState): void
}

export const useSession = create<SessionStore>()((set, get) => {
  const apply = (ev: StreamEvent) => {
    switch (ev.type) {
      case 'text':
        set((s) => {
          const last = s.messages.at(-1)
          return last?.id === ev.msg_id
            ? { messages: [...s.messages.slice(0, -1), { ...last, text: last.text + ev.delta }] }
            : { messages: [...s.messages, { id: ev.msg_id, role: 'assistant', text: ev.delta }] }
        })
        break
      case 'ui':
        set((s) => ({ ui: [...s.ui, { id: ev.id, block: ev.block, interactive: ev.interactive, answered: false }] }))
        break
      case 'state':
        get().mergeState(ev.state)
        break
      case 'error':
        set({ error: `${ev.code}: ${ev.message}` })
        break
      default: // turn_start, stage, mascot, done: not used by the scaffold
    }
  }

  const turn = async (body: Parameters<typeof streamTurn>[1]) => {
    const { sessionId } = get()
    if (!sessionId || get().busy) return
    set({ busy: true, error: null })
    try {
      for await (const ev of streamTurn(sessionId, body)) apply(ev)
    } catch (e) {
      set({ error: String(e) })
    } finally {
      set({ busy: false })
    }
  }

  return {
    sessionId: null,
    engine: null,
    state: null,
    messages: [],
    ui: [],
    busy: false,
    error: null,
    mergeState: (next) => set((s) => (!s.state || next.version > s.state.version ? { state: next } : {})),
    async start({ engine, demo }) {
      const { data, error } = await api.POST('/api/sessions', {
        body: { engine: engine ?? null, demo_golfer_id: demo ?? null, host: { platform: 'standalone' } },
      })
      if (!data) {
        set({ error: `session failed: ${JSON.stringify(error)}` })
        return
      }
      set({ sessionId: data.session_id, engine: engine ?? null, state: null })
      get().mergeState(data.state)
      // A turn needs a message: a hidden "Hi" opens the scripted/live conversation.
      await turn({ message: { kind: 'text', text: 'Hi' } })
    },
    say: (text) => {
      set((s) => ({ messages: [...s.messages, { id: `u-${s.messages.length}`, role: 'user', text }] }))
      return turn({ message: { kind: 'text', text } })
    },
    respond(componentId, value, displayText) {
      set((s) => ({
        ui: s.ui.map((u) => (u.id === componentId ? { ...u, answered: true } : u)),
        messages: [...s.messages, { id: `u-${s.messages.length}`, role: 'user', text: displayText }],
      }))
      return turn({ message: { kind: 'ui_response', component_id: componentId, value, display_text: displayText } })
    },
  }
})
