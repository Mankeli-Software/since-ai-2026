import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useSession } from '@/store/session'
import { askFor, resolveAnswer } from './answers'
import { takeSentences } from './sentences'
import { speaker } from './speaker'
import { errorText, LANGS, listenOnce } from './speech'
import { norm } from './spoken'
import { useVoice } from './store'

const STOP = /^(stop|stop talking|end|goodbye|bye|that's all|lopeta)\b/
const REPEAT = /^(repeat|say (that|it) again|again|come again|pardon|sorry what|what was that|toista)\b/

/**
 * The hands-free voice loop (#51, `?ff=voice`). Half duplex, so the mic never hears the fitter:
 *
 *   listen -> the golfer pauses -> answer the open card (or send it as chat text) -> the reply streams
 *   and is spoken sentence by sentence (ElevenLabs) -> the next card's question is read out -> listen
 *
 * Tapping a card still works at any point and cuts the fitter off. "Stop" ends voice, "repeat" re-reads.
 * Every number the fitter says comes from the same streamed text the screen shows (invariant 14).
 * Mounted once in Studio, so it keeps going from the chat into the results view.
 */
export function useVoiceConversation() {
  const on = useVoice((s) => s.on)
  const nudge = useVoice((s) => s.nudge)
  const lang = useVoice((s) => s.lang)
  const messages = useSession((s) => s.messages)
  const busy = useSession((s) => s.busy)
  const sessionId = useSession((s) => s.sessionId)
  const demo = useSession((s) => s.demo)
  const ui = useSession((s) => s.ui)
  // The open card: the latest input block still waiting, wherever it is shown.
  const active = useMemo(() => ui.filter((u) => u.interactive && !u.answered).at(-1) ?? null, [ui])

  const [speaking, setSpeaking] = useState(false)
  const [tick, setTick] = useState(0)
  const spokenTo = useRef(new Map<string, number>()) // message id -> characters already queued
  const asked = useRef(new Set<string>())
  const stopListening = useRef<((abort?: boolean) => void) | null>(null)
  const handling = useRef(false)
  const paused = useRef(false)
  const misses = useRef(0)
  const seenNudge = useRef(0)
  const lastUser = useRef<string | undefined>(undefined)
  const activeRef = useRef(active)
  activeRef.current = active

  useEffect(() => {
    speaker.sessionId = sessionId
    speaker.onChange = setSpeaking
  }, [sessionId])

  // Voice on: the fitter's current line and open card are read out; older history is not.
  // Voice off: stop talking and listening.
  useEffect(() => {
    if (!on) {
      stopListening.current?.(true)
      stopListening.current = null
      speaker.stop()
      return
    }
    const msgs = useSession.getState().messages
    const userSeq = msgs.filter((m) => m.role === 'user').at(-1)?.seq ?? 0
    spokenTo.current = new Map(msgs.filter((m) => m.seq <= userSeq).map((m) => [m.id, m.text.length]))
    asked.current.clear()
    lastUser.current = msgs.filter((m) => m.role === 'user').at(-1)?.id
    paused.current = false
    misses.current = 0
  }, [on])

  // The golfer answered (by voice, tap or typing): drop whatever the fitter was still saying.
  const userId = messages.filter((m) => m.role === 'user').at(-1)?.id
  useEffect(() => {
    if (!on || userId === lastUser.current) return
    lastUser.current = userId
    speaker.stop()
  }, [on, userId])

  // Speak the reply as it streams: each complete sentence goes to the speaker at once.
  useEffect(() => {
    if (!on) return
    const last = messages.at(-1)
    for (const m of messages) {
      if (m.role !== 'assistant') continue
      const from = spokenTo.current.get(m.id) ?? 0
      if (from >= m.text.length && (busy || m.text.length === 0)) continue
      const { parts, next } = takeSentences(m.text, from, !busy || m !== last)
      spokenTo.current.set(m.id, next)
      for (const p of parts) speaker.say(p, lang)
    }
  }, [on, messages, busy, lang])

  // Then put the open card's question out loud, once.
  const activeId = active?.id
  useEffect(() => {
    const a = activeRef.current
    if (!on || busy || !a || asked.current.has(a.id) || !sessionId) return
    asked.current.add(a.id)
    const q = askFor(a.block, { sessionId, demo })
    if (q) speaker.say(q, lang)
  }, [on, busy, activeId, sessionId, demo, lang])

  // Listen whenever nobody else is talking. Sets the bar's phase.
  useEffect(() => {
    const v = useVoice.getState()
    if (!on) return
    if (nudge !== seenNudge.current) {
      seenNudge.current = nudge
      paused.current = false
      misses.current = 0
    }
    if (speaking) return v.set({ phase: 'speaking' })
    if (busy || handling.current) return v.set({ phase: 'thinking' })
    if (stopListening.current) return
    if (paused.current) return v.set({ phase: 'paused' })

    let heard = ''
    v.set({ phase: 'listening', heard: '', note: null })
    stopListening.current = listenOnce(v.lang, {
      onInterim: (t) => useVoice.getState().set({ heard: t }),
      onFinal: (t) => {
        heard = t
      },
      onError: (code) => {
        if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture') {
          useVoice.getState().toggle()
          useVoice.getState().set({ note: errorText(code) })
          return
        }
        if (code === 'no-speech' && ++misses.current < 2) return
        paused.current = true
        useVoice.getState().set({ note: errorText(code) })
      },
      onEnd: () => {
        stopListening.current = null
        if (heard) {
          misses.current = 0
          void handle(heard)
        }
        setTick((t) => t + 1)
      },
    })
    if (!stopListening.current) paused.current = true
    // `tick` re-runs this after each utterance and after each handled answer.
  }, [on, speaking, busy, nudge, tick])

  async function handle(text: string) {
    const v = useVoice.getState()
    const n = norm(text)
    const short = n.split(' ').length <= 4
    if (short && STOP.test(n)) return v.toggle()
    const s = useSession.getState()
    const a = activeRef.current
    if (short && REPEAT.test(n)) {
      const userSeq = s.messages.filter((m) => m.role === 'user').at(-1)?.seq ?? 0
      for (const m of s.messages) if (m.role === 'assistant' && m.seq > userSeq) speaker.say(m.text, v.lang)
      if (a && s.sessionId) speaker.say(askFor(a.block, { sessionId: s.sessionId, demo: s.demo }), v.lang)
      return
    }
    handling.current = true
    v.set({ phase: 'thinking', heard: text })
    try {
      if (a && s.sessionId) {
        const h = await resolveAnswer(a.block, text, { sessionId: s.sessionId, demo: s.demo })
        if (h) return void (await s.respond(a.id, h.value, h.display))
      }
      await s.say(text)
    } finally {
      handling.current = false
      setTick((t) => t + 1)
    }
  }
}

const LABEL = {
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Fitter is talking · tap to cut in',
  paused: 'Tap the mic to talk',
} as const

/** The voice strip above the composer: state, live transcript, language, end. Hidden when voice is off. */
export function VoiceBar({ className }: { className?: string }) {
  const { on, phase, heard, note, lang, tap, toggle, set } = useVoice()
  if (!on) return null
  const nextLang = LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-[28px] border border-grey-2a bg-grey-14 py-2 pr-2 pl-2 text-washed-white',
        className,
      )}
    >
      <button
        type="button"
        onClick={tap}
        aria-label={phase === 'speaking' ? 'Interrupt the fitter and talk' : 'Talk now'}
        className={cn(
          'relative inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-full border-0 transition-ui',
          phase === 'listening' ? 'bg-tiger-orange' : 'bg-grey-26 hover:bg-grey-3d',
        )}
      >
        {phase === 'listening' && (
          <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-tiger-orange opacity-40" />
        )}
        {phase === 'speaking' || phase === 'thinking' ? (
          <span aria-hidden="true" className="flex h-4 items-end gap-[3px]">
            {[0, 120, 240, 360].map((d) => (
              <span
                key={d}
                className={cn('w-[3px] rounded-full bg-tiger-orange', phase === 'speaking' ? 'h-4 animate-pulse' : 'h-1.5 opacity-60')}
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </span>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={phase === 'listening' ? '#0B0B0B' : '#FF6E01'} strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="relative">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col" role="status" aria-live="polite">
        <span className="font-display text-[13px] font-bold uppercase tracking-[0.06em] text-grey-a3">
          {LABEL[phase]}
          {phase === 'listening' || phase === 'thinking' ? '…' : ''}
        </span>
        {note ? (
          <span className="truncate text-[15px] text-orange-light">{note}</span>
        ) : (
          heard && <span className="truncate text-[16px] text-washed-white">“{heard}”</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => set({ lang: nextLang })}
        disabled={phase === 'listening'}
        aria-label={`Voice language ${lang}. Switch to ${nextLang}`}
        className="h-9 flex-none cursor-pointer rounded-full border-0 bg-transparent px-2.5 font-display text-[13px] font-bold tracking-[0.05em] text-grey-a3 hover:text-washed-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {lang.slice(0, 2).toUpperCase()}
      </button>
      <button
        type="button"
        onClick={toggle}
        className="h-9 flex-none cursor-pointer rounded-full border border-grey-3d bg-transparent px-4 font-display text-[14px] font-bold uppercase tracking-[0.05em] text-washed-white hover:bg-grey-26"
      >
        End
      </button>
    </div>
  )
}
