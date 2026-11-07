import { lazy, Suspense, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useSession } from '@/store/session'
import { StudioStart } from '../personas/StudioStart'
import { StageBoundary } from './StageBoundary'

// Lazy so the chat renders before three.js loads.
const ClubStage = lazy(() => import('../stage3d'))

// Placeholder shell: #36 builds the real layout and TopBar, #38 the chat, #39 the Gen-UI renderer.
export function Studio() {
  const { messages, ui, busy, error, state, start, respond } = useSession()

  const q = new URLSearchParams(location.search)
  const picking = !q.has('demo') && !q.has('start') // no persona chosen yet: show the start screen

  useEffect(() => {
    if (picking) return
    const q = new URLSearchParams(location.search)
    const engine = q.get('engine')
    void start({ engine: engine === 'live' || engine === 'scripted' ? engine : undefined, demo: q.get('demo') })
  }, [start, picking])

  if (picking) return <StudioStart />

  return (
    <div className="grid h-screen grid-cols-[1fr_28rem]">
      <section className="min-w-0 bg-secondary">
        <StageBoundary><div className="h-full">
          <Suspense fallback={<p className="p-4">Loading stage...</p>}>
            <ClubStage />
          </Suspense>
        </div></StageBoundary>
      </section>
      <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto border-l border-border p-4">
        <p className="text-sm text-muted-foreground">
          state v{state?.version ?? '-'} {busy && '(streaming...)'}
        </p>
        {messages.map((m) => (
          <p key={m.id} className={m.role === 'user' ? 'self-end bg-secondary px-3 py-1' : 'whitespace-pre-line'}>
            {m.text}
          </p>
        ))}
        {ui.map((u) =>
          u.block.type === 'choice_chips' ? (
            <div key={u.id} className="flex flex-wrap gap-2">
              <p className="w-full font-semibold">{u.block.prompt}</p>
              {u.block.options.map((o) => (
                <Button
                  key={o.id}
                  variant="secondary"
                  disabled={u.answered || busy}
                  onClick={() => void respond(u.id, o.id, o.label)}
                >
                  {o.label}
                </Button>
              ))}
            </div>
          ) : (
            <pre key={u.id} className="overflow-x-auto bg-muted p-2 text-xs">
              {JSON.stringify(u.block, null, 1)}
            </pre>
          ),
        )}
        {error && <p className="text-destructive">{error}</p>}
      </aside>
    </div>
  )
}
