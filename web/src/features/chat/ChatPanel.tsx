import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { GenUiBlock } from '@/features/genui/GenUiBlock'
import { useSession } from '@/store/session'
import { VoiceControls } from '@/features/voice/VoiceControls'
import { Text } from './Text'

export function ChatPanel() {
  const { messages, ui, busy, error, respond, say, sessionId } = useSession()
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  // One timeline in arrival order.
  const items = useMemo(
    () =>
      [
        ...messages.map((m) => ({ seq: m.seq, m })),
        ...ui.map((u) => ({ seq: u.seq, u })),
      ].sort((a, b) => a.seq - b.seq),
    [messages, ui],
  )

  // Streaming text grows the last message: follow it too.
  const lastLen = messages.at(-1)?.text.length ?? 0
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [items.length, lastLen, busy])

  const send = () => {
    const t = draft.trim()
    if (!t || busy) return
    setDraft('')
    void say(t)
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
        {items.map((it) =>
          'm' in it ? (
            <p
              key={it.m.id}
              className={
                it.m.role === 'user'
                  ? 'max-w-[85%] self-end rounded-lg rounded-br-sm bg-surface-dark px-4 py-2.5 text-[15px] leading-relaxed text-washed-white'
                  : 'max-w-[92%] border-l-2 border-accent pl-3 text-[15px] leading-relaxed text-ink-800'
              }
            >
              <Text text={it.m.text} />
            </p>
          ) : (
            <div key={it.u.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <GenUiBlock
                id={it.u.id}
                block={it.u.block}
                interactive={it.u.interactive && !it.u.answered}
                answer={it.u.answer}
                busy={busy}
                respond={(v, d) => void respond(it.u.id, v, d)}
              />
            </div>
          ),
        )}
        {busy && <p className="text-sm italic text-muted-foreground" aria-live="polite">Thinking…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div ref={endRef} />
      </div>
      <form
        className="flex gap-2 border-t border-border bg-card px-6 py-4"
        onSubmit={(e) => { e.preventDefault(); send() }}
      >
        <VoiceControls disabled={busy || !sessionId} onTranscript={(t) => setDraft((d) => (d.trim() ? `${d.trim()} ${t}` : t))} />
        <input
          className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-[15px] placeholder:text-ink-400 disabled:opacity-60"
          placeholder="Type a message"
          aria-label="Message"
          value={draft}
          disabled={busy || !sessionId}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button type="submit" className="h-10 px-5 bg-accent text-accent-foreground hover:bg-orange-300" disabled={busy || !sessionId || !draft.trim()}>Send</Button>
      </form>
    </>
  )
}
