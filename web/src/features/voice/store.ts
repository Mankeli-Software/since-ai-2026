import { create } from 'zustand'
import { hasFlag } from '@/lib/flags'
import { speaker } from './speaker'
import { canListen, type Lang } from './speech'

export type VoicePhase = 'listening' | 'thinking' | 'speaking' | 'paused'

interface VoiceStore {
  /** The hands-free conversation is on. */
  on: boolean
  phase: VoicePhase
  /** Words heard so far (interim), then the final utterance until the reply starts. */
  heard: string
  lang: Lang
  /** A short note for the bar: mic blocked, didn't catch that. */
  note: string | null
  /** Bumped to ask the loop to listen now (tap on the orb while speaking or paused). */
  nudge: number
  set(p: Partial<Omit<VoiceStore, 'set' | 'toggle' | 'tap'>>): void
  /** "Say it": turn the conversation on or off. Runs inside the tap, so audio unlocks. */
  toggle(): void
  /** The orb: interrupt the fitter, or wake the mic after a pause. */
  tap(): void
}

/** `?ff=voice` and a browser that can listen (Chrome, Edge, Safari). */
export const voiceAvailable = () => hasFlag('voice') && canListen

export const useVoice = create<VoiceStore>()((set, get) => ({
  on: false,
  phase: 'paused',
  heard: '',
  lang: 'en-US',
  note: null,
  nudge: 0,
  set: (p) => set(p),
  toggle() {
    if (get().on) {
      speaker.stop()
      set({ on: false, phase: 'paused', heard: '', note: null })
      return
    }
    speaker.unlock()
    set({ on: true, phase: 'paused', heard: '', note: null, nudge: get().nudge + 1 })
  },
  tap() {
    speaker.stop()
    set({ note: null, nudge: get().nudge + 1 })
  },
}))
