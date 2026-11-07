import { lazy, Suspense, useEffect } from 'react'
import { hasFlag } from '@/lib/flags'
import { useSession } from '@/store/session'
import { StudioStart } from '../personas/StudioStart'
import { ChatColumn } from './ChatColumn'
import { StageBoundary } from './StageBoundary'
import { TopBar } from './TopBar'

// Lazy so the chat renders before three.js loads.
const ClubStage = lazy(() => import('../stage3d'))

/**
 * Desktop layout (L3): stage left, chat right. At the reveal (a best spec exists) the chat
 * narrows to a side panel and the stage grows (CSS transition only). `?ff=reveal` forces it.
 * Without `demo` or `start` in the URL, the #37 start screen shows instead of a session.
 */
export function Studio() {
  const revealed = useSession((s) => s.state?.best != null) || hasFlag('reveal')
  const start = useSession((s) => s.start)

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
    <div className="flex h-screen flex-col">
      <TopBar />
      <div
        className="grid min-h-0 flex-1 transition-[grid-template-columns] duration-500"
        style={{ gridTemplateColumns: revealed ? '3fr 1fr' : '1fr 1fr' }}
      >
        <section className="min-w-0 bg-secondary">
          <StageBoundary>
            <div className="h-full">
              <Suspense fallback={<p className="p-4">Loading stage...</p>}>
                <ClubStage />
              </Suspense>
            </div>
          </StageBoundary>
        </section>
        <aside className="flex min-h-0 min-w-0 flex-col border-l border-border">
          <ChatColumn />
        </aside>
      </div>
    </div>
  )
}
