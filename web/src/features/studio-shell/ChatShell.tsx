import { useEffect, useMemo } from 'react'
import { ClubModel } from '@/features/stage3d/ClubModel'
import { cn } from '@/lib/utils'
import { useSession } from '@/store/session'
import { VoiceBar } from '@/features/voice/VoiceConversation'
import { Composer } from './Composer'
import { ConversationCard, DisplayCard } from './ConversationCard'
import { ConversationHistory } from './ConversationHistory'
import { FitterLine, Thinking } from './FitterLine'
import { RecapRow } from './RecapRow'
import { stepFor } from './stepFor'
import { StudioHeader } from './StudioHeader'

/** Ghost club opacity: 0.45 with no data, 0.85 from 80% confidence (spec §2.1 "club materialises"). */
const ghostOpacity = (confidence: number | null | undefined) => 0.45 + 0.4 * Math.min(1, Math.max(0, (confidence ?? 0) / 0.8))

/**
 * v3 chat phase (spec §2.1, mockups V3-C2..C6): one centred column on the dark bay with the recap row,
 * the fitter's latest line, ONE light input card and the dark composer. Earlier turns sit behind
 * "Show conversation". The SSE / gen-UI model is unchanged: the card is the latest unanswered input block.
 */
export function ChatShell() {
  const { state, messages, ui, busy, error, sessionId, say, respond } = useSession()

  const view = useMemo(() => {
    const lastUserSeq = messages.filter((m) => m.role === 'user').at(-1)?.seq ?? 0
    const active = ui.filter((u) => u.interactive && !u.answered).at(-1) ?? null
    const turnDisplay = ui.filter((u) => !u.interactive && u.seq > lastUserSeq)
    // Display blocks that came with the card render inside it, above the input; the rest go below the line.
    const above = active ? turnDisplay.filter((u) => u.seq < active.seq) : []
    const loose = turnDisplay.filter((u) => !above.includes(u))
    // The step never moves backwards; with no active block it keeps the last one.
    const step = ui.reduce((n, u) => Math.max(n, stepFor(u.block) ?? 0), 0) || 1
    return {
      active,
      above,
      loose,
      step,
      fitter: messages.filter((m) => m.role === 'assistant' && m.seq > lastUserSeq),
      recap: ui.filter((u) => u.interactive && u.answered && u.answer).slice(-3),
      history: {
        messages: messages.filter((m) => m.seq <= lastUserSeq),
        ui: ui.filter((u) => u.seq < lastUserSeq),
      },
      // C2: the first card is the sentence builder, shown wider with its own light composer.
      first: active?.block.type === 'sentence_builder' && !ui.some((u) => u.answered),
    }
  }, [messages, ui])

  // A new card starts at the top of the column.
  const activeId = view.active?.id
  useEffect(() => {
    if (activeId) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeId])

  const sendDisabled = busy || !sessionId
  const respondTo = (id: string, v: unknown, d: string) => void respond(id, v, d)

  return (
    <div className="bg-bay relative flex min-h-screen w-full flex-col overflow-hidden font-sans antialiased">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[165px] -right-[46px] h-[442px] w-[408px] bg-[radial-gradient(ellipse_at_50%_60%,rgba(255,110,1,.14),transparent_65%)] max-md:hidden"
      />
      <ClubModel
        slug={state?.best?.head ?? '201t-mkii'}
        className="absolute top-[160px] -right-[26px] h-[460px] drop-shadow-club transition-[opacity] duration-[600ms] ease-out max-md:hidden"
        style={{ opacity: ghostOpacity(state?.confidence) }}
      />
      <StudioHeader variant="chat" step={view.step} />
      <main
        className={cn(
          'relative mx-auto flex w-full flex-1 flex-col px-10 max-md:px-4',
          view.first ? 'max-w-[1060px] gap-6 pt-11 max-md:gap-4 max-md:pt-2' : 'max-w-[960px] gap-[22px] pt-8 max-md:gap-4 max-md:pt-2',
        )}
      >
        <ConversationHistory messages={view.history.messages} ui={view.history.ui} />
        <RecapRow items={view.recap} />
        <FitterLine messages={view.fitter} />
        {view.loose.map((u) => (
          <DisplayCard key={u.id} item={u} />
        ))}
        {view.active ? (
          <ConversationCard
            item={view.active}
            above={view.above}
            busy={busy}
            respond={respondTo}
            footer={
              view.first && (
                <div className="flex flex-col gap-2.5 border-t border-grey-e4 pt-4">
                  <span className="text-[16px] text-grey-33 max-md:text-[15px]">Not sure, or easier to explain? Type or say it</span>
                  <Composer
                    tone="light"
                    onSend={(t) => void say(t)}
                    disabled={sendDisabled}
                    label="Tell the fitter about yourself"
                    placeholder="Type or say it: about 8 years, twice a month, mostly weekends…"
                  />
                </div>
              )
            }
          />
        ) : (
          busy && <Thinking />
        )}
        {error && (
          <p role="alert" className="m-0 rounded-10 bg-grey-16 px-4 py-3 text-[15px] text-orange-light">
            Something went wrong: {error}
          </p>
        )}
        {/* C2 has the composer inside the card instead. Pinned to the bottom while a tall card scrolls. */}
        {view.first ? (
          <div className="pb-10 max-md:pb-6">
            <VoiceBar />
          </div>
        ) : (
          <div className="sticky bottom-0 mt-auto bg-[linear-gradient(to_top,#0B0B0B_55%,transparent)] pt-4 pb-7 max-md:-mx-4 max-md:px-4 max-md:pt-2.5 max-md:pb-[18px]">
            <VoiceBar className="mb-2.5" />
            <Composer onSend={(t) => void say(t)} disabled={sendDisabled} />
          </div>
        )}
      </main>
    </div>
  )
}
