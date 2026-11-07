import { createContext, useContext, useState, type FormEvent } from 'react'
import { FitterAvatar } from '@/components/studio'
import { useVoice, voiceAvailable } from '@/features/voice/store'
import { VoiceBar } from '@/features/voice/VoiceConversation'
import { useSession } from '@/store/session'
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
  const text = message ?? defaults.assistantText ?? fallback ?? defaults.fallback
  return (
    <>
      {text && (
        <p className="m-0 text-[18px] leading-[1.5] text-washed-white">
          <Text text={text} />
        </p>
      )}
      {children}
      {block && <GenUiBlock id={`aside-${block.type}`} block={block} interactive={false} busy={busy} respond={() => {}} />}
      {chips && chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              disabled={busy}
              onClick={() => void say(c)}
              className="h-[38px] cursor-pointer rounded-full border border-grey-3d bg-transparent px-3.5 text-[14px] font-medium text-washed-white transition-ui hover:border-grey-8f disabled:cursor-default disabled:opacity-50"
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

export interface FitterAsideProps {
  /** Default suggestion chips (no override mounted). */
  chips: string[]
  /** Portal target for ResultsAside overrides. */
  slotRef: (el: HTMLElement | null) => void
  /** A ResultsAside is mounted: hide the default body. */
  overridden: boolean
}

/** "Your fitter" aside (spec §2.2): avatar + title, message, optional embedded block, chips, composer. */
export function FitterAside({ chips, slotRef, overridden }: FitterAsideProps) {
  return (
    <aside
      aria-label="Your fitter"
      className="flex min-h-0 w-[380px] flex-none flex-col gap-4 border-l border-grey-1f bg-grey-0f p-6"
    >
      <div className="flex flex-none items-center gap-3">
        <FitterAvatar size={36} />
        <span className="text-[16px] font-semibold">Your fitter</span>
      </div>
      {/* Only the middle scrolls: header and composer stay put at 1280×800. */}
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
        {!overridden && <AsideBody chips={chips} />}
        <div ref={slotRef} className="contents" />
      </div>
      <VoiceBar />
      <Composer />
    </aside>
  )
}
