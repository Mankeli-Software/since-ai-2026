import { createContext, useContext, useEffect, useRef, useState, type FormEvent } from 'react'
import { FitterAvatar } from '@/components/studio'
import { useVoice, voiceAvailable } from '@/features/voice/store'
import { VoiceBar } from '@/features/voice/VoiceConversation'
import { cn } from '@/lib/utils'
import { useSession, type ChatMessage } from '@/store/session'
import { Text } from '../chat/Text'
import { GenUiBlock } from '../genui/GenUiBlock'
import type { ResultsAsideProps } from './chrome'

/**
 * What the aside message falls back to. ResultsShell provides it around the whole body: ResultsAside portals
 * keep the React context of the view that renders them, so the provider must sit above the views.
 */
export const AsideDefaults = createContext<{ assistantText: string | null; fallback: string }>({ assistantText: null, fallback: '' })

/** Message, optional embedded slot, suggestion chips. Used for the default body and by ResultsAside overrides. */
export function AsideBody({ message, fallback, chips, block, children }: ResultsAsideProps) {
  const defaults = useContext(AsideDefaults)
  const say = useSession((s) => s.say)
  const busy = useSession((s) => s.busy)
  const ui = useSession((s) => s.ui)
  const respond = useSession((s) => s.respond)
  const messages = useSession((s) => s.messages)

  let latestAssistant: ChatMessage | undefined
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant' && messages[i].text.trim()) {
      latestAssistant = messages[i]
      break
    }
  }

  const prevMessageRef = useRef<string | undefined>(message)
  const baselineSeqRef = useRef<number>(latestAssistant?.seq ?? 0)

  if (prevMessageRef.current !== message) {
    prevMessageRef.current = message
    baselineSeqRef.current = latestAssistant?.seq ?? 0
  }

  const isReplyNewer = Boolean(latestAssistant && latestAssistant.seq > baselineSeqRef.current)
  const text = (isReplyNewer && latestAssistant ? latestAssistant.text : null) ?? message ?? defaults.assistantText ?? fallback ?? defaults.fallback

  // Latest pending ui_input block in session store (stock_vs_custom is handled on R5).
  const pending = [...ui].reverse().find((u) => u.interactive && !u.answered && u.block.type !== 'stock_vs_custom')
  const activeBlock = pending ? pending.block : block

  return (
    <>
      {text && (
        <p className="m-0 text-[18px] leading-[1.5] text-washed-white">
          <Text text={text} />
        </p>
      )}
      {children}
      {activeBlock && (
        <div className="rounded-14 border border-border bg-card p-4 text-card-foreground shadow-sm">
          <GenUiBlock
            id={pending ? pending.id : `aside-${activeBlock.type}`}
            block={activeBlock}
            interactive={pending ? !busy : false}
            answer={pending?.answer}
            busy={busy}
            respond={pending ? (v, d) => void respond(pending.id, v, d) : () => {}}
          />
        </div>
      )}
      {chips && chips.length > 0 && (
        <div className="flex flex-wrap gap-2 max-md:flex-nowrap max-md:overflow-x-auto max-md:[scrollbar-width:none]">
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              disabled={busy}
              onClick={() => void say(c)}
              className="h-[38px] cursor-pointer rounded-full border border-grey-3d bg-transparent px-3.5 text-[14px] font-medium text-washed-white transition-ui hover:border-grey-8f disabled:cursor-default disabled:opacity-50 max-md:h-11 max-md:flex-none max-md:whitespace-nowrap"
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

function Composer() {
  const say = useSession((s) => s.say)
  const busy = useSession((s) => s.busy)
  const [text, setText] = useState('')
  const voice = voiceAvailable()
  const talking = useVoice((s) => s.on)
  const toggleVoice = useVoice((s) => s.toggle)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const t = text.trim()
    if (!t || busy) return
    setText('')
    void say(t)
  }

  return (
    <form
      onSubmit={submit}
      className="flex h-[54px] flex-none items-center gap-2 rounded-full border border-grey-2a bg-grey-16 pr-1.5 pl-[18px]"
    >
      <label htmlFor="results-ask" className="sr-only">
        Ask the fitter
      </label>
      <input
        id="results-ask"
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ask about your fit…"
        autoComplete="off"
        className="min-w-0 flex-1 border-0 bg-transparent text-[16px] text-washed-white outline-none placeholder:text-grey-8f"
      />
      <button
        type="button"
        aria-label={talking ? 'End voice' : 'Say it'}
        aria-pressed={voice ? talking : undefined}
        disabled={!voice}
        title={voice ? (talking ? 'End the voice conversation' : 'Talk with the fitter, hands free') : 'Voice needs Chrome, Edge or Safari'}
        onClick={toggleVoice}
        className={`inline-flex size-[42px] flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-grey-26 disabled:cursor-default disabled:opacity-50 ${talking ? 'shadow-[inset_0_0_0_2px_#FF6E01]' : ''}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6E01" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      </button>
    </form>
  )
}

function ConversationLog() {
  const messages = useSession((s) => s.messages)
  const visible = messages.filter((m) => m.text.trim().length > 0)
  if (visible.length === 0) return null

  return (
    <details className="mt-2 border-t border-grey-1f pt-3 text-[13px] text-grey-8f">
      <summary className="cursor-pointer select-none font-medium text-grey-a3 transition-colors hover:text-washed-white">
        Show conversation
      </summary>
      <div className="mt-3 flex flex-col gap-2.5">
        {visible.map((m) => (
          <div
            key={m.id}
            className={
              m.role === 'user'
                ? 'max-w-[85%] self-end rounded-lg bg-grey-1a px-3 py-1.5 text-right text-washed-white'
                : 'max-w-[95%] self-start rounded-lg bg-grey-12 px-3 py-1.5 text-grey-c8'
            }
          >
            <span className="mb-0.5 block text-[11px] font-semibold tracking-wider text-grey-8f uppercase">
              {m.role === 'user' ? 'You' : 'Fitter'}
            </span>
            <p className="m-0 text-[13px] leading-relaxed">
              <Text text={m.text} />
            </p>
          </div>
        ))}
      </div>
    </details>
  )
}

export interface FitterAsideProps {
  /** Default suggestion chips (no override mounted). */
  chips: string[]
  /** Portal target for ResultsAside overrides. */
  slotRef: (el: HTMLElement | null) => void
  /** A ResultsAside is mounted: hide the default body. */
  overridden: boolean
  /** Phones only: the aside is a bottom sheet, shown while this is true. */
  sheetOpen?: boolean
  onCloseSheet?: () => void
}

/**
 * "Your fitter" aside (spec §2.2): avatar + title, message, optional embedded block, chips, composer.
 * Phones (M-R1-Fitter): the same element becomes a bottom sheet over a dimmed page, so ResultsAside portals keep
 * working; it is hidden until "Ask the fitter" opens it.
 */
export function FitterAside({ chips, slotRef, overridden, sheetOpen = false, onCloseSheet }: FitterAsideProps) {
  useEffect(() => {
    if (!sheetOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseSheet?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen, onCloseSheet])

  return (
    <>
      {sheetOpen && <div aria-hidden="true" onClick={onCloseSheet} className="fixed inset-0 z-40 bg-black/60 md:hidden" />}
      <aside
        aria-label="Your fitter"
        className={cn(
          'flex min-h-0 w-[380px] flex-none flex-col gap-4 border-l border-grey-1f bg-grey-0f p-6',
          'max-md:fixed max-md:inset-x-0 max-md:top-12 max-md:bottom-0 max-md:z-50 max-md:w-auto max-md:rounded-t-20 max-md:border-t max-md:border-l-0 max-md:px-4 max-md:pt-2 max-md:pb-[18px] max-md:shadow-[0_-20px_40px_rgba(0,0,0,.5)]',
          !sheetOpen && 'max-md:hidden',
        )}
      >
        <span aria-hidden="true" className="mx-auto h-1 w-10 flex-none rounded-full bg-grey-3d md:hidden" />
        <div className="flex flex-none items-center gap-3">
          <FitterAvatar size={36} />
          <span className="text-[16px] font-semibold">Your fitter</span>
          <button
            type="button"
            onClick={onCloseSheet}
            aria-label="Close the fitter"
            className="-mr-2 ml-auto inline-flex size-11 cursor-pointer items-center justify-center border-0 bg-transparent text-washed-white md:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {/* Only the middle scrolls: header and composer stay put at 1280×800. */}
        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
          {!overridden && <AsideBody chips={chips} />}
          <div ref={slotRef} className="contents" />
          <ConversationLog />
        </div>
        <VoiceBar />
        <Composer />
      </aside>
    </>
  )
}
