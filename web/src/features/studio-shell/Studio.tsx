import { useEffect } from 'react'
import { hasFlag, isV3 } from '@/lib/flags'
import { useSession } from '@/store/session'
import { StudioStart } from '../personas/StudioStart'
import { Welcome } from '../personas/Welcome'
import { isResultPhase } from '../result/phase'
import ResultsShell from '../result/ResultsShell'
import { ChatColumn } from './ChatColumn'
import { ChatShell } from './ChatShell'
import { useVoiceConversation } from '@/features/voice/VoiceConversation'
import { StageBoundary } from './StageBoundary'
import { StagePanel } from './StagePanel'
import { TopBar } from './TopBar'

/**
 * Desktop layout (L3): stage left, chat right. At the reveal (a best spec exists) the chat
 * narrows to a side panel and the stage grows (CSS transition only). `?ff=reveal` forces it.
 * Without `demo` or `start` in the URL, the #37 start screen shows instead of a session.
 * Default is Flow v3 (C1 welcome, chat phase, results phase); `?ff=legacy` shows the old two-column layout.
 */
export function Studio() {
  const v3 = isV3()
  const revealed = useSession((s) => s.state?.best != null) || hasFlag('reveal')
  const resultPhase = useSession((s) => isResultPhase(s.state, s.ui))
  const start = useSession((s) => s.start)
  const resume = useSession((s) => s.resume)
  // Hands-free voice (on by default, `?ff=novoice` turns it off): one loop across the chat and the results view.
  useVoiceConversation()

  const q = new URLSearchParams(location.search)
  const resumeToken = q.get('resume')
  const picking = !q.has('demo') && !q.has('start') && !resumeToken

  useEffect(() => {
    if (picking) return
    const q = new URLSearchParams(location.search)
    const token = q.get('resume')
    if (token) {
      void resume(token)
      return
    }
    const engine = q.get('engine')
    void start({ engine: engine === 'live' || engine === 'scripted' ? engine : undefined, demo: q.get('demo') })
  }, [start, resume, picking])

  if (v3) {
    if (picking) return <Welcome />
    return resultPhase ? <ResultsShell /> : <ChatShell />
  }

  if (picking) return <StudioStart />

  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      <div
        className="grid min-h-0 flex-1 transition-[grid-template-columns] duration-500"
        style={{ gridTemplateColumns: revealed ? '3fr 1fr' : '1fr 1fr' }}
      >
        <section className="min-w-0 bg-[radial-gradient(ellipse_at_50%_40%,var(--color-surface-dark-3),var(--color-surface-dark)_70%)] text-washed-white">
          <StageBoundary>
            <div className="h-full">
              <StagePanel />
            </div>
          </StageBoundary>
        </section>
        <aside className="flex min-h-0 min-w-0 flex-col border-l border-border bg-background">
          <ChatColumn />
        </aside>
      </div>
    </div>
  )
}
