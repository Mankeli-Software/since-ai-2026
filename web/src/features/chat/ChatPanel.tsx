import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { GenUiBlock } from '@/features/genui/GenUiBlock'
import { useSession } from '@/store/session'
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
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {items.map((it) =>
          'm' in it ? (
            <p
              key={it.m.id}
              className={
                it.m.role === 'user'
                  ? 'max-w-[85%] self-end rounded-lg bg-secondary px-3 py-2 text-sm'
                  : 'max-w-[90%] text-sm'
              }
            >
              <Text text={it.m.text} />
            </p>
          ) : (
            <div key={it.u.id} className="rounded-lg border border-border bg-background p-3">
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
        {busy && <p className="text-sm text-muted-foreground" aria-live="polite">Thinking…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div ref={endRef} />
      </div>
      <form
        className="flex gap-2 border-t border-border p-3"
        onSubmit={(e) => { e.preventDefault(); send() }}
      >
        <input
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
          placeholder="Type a message"
          aria-label="Message"
          value={draft}
          disabled={busy || !sessionId}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button type="submit" disabled={busy || !sessionId || !draft.trim()}>Send</Button>
      </form>
    </>
  )
}
