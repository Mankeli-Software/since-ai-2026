import { useId, useRef, useState } from 'react'
import { hasFlag } from '@/lib/flags'
import { cn } from '@/lib/utils'

/** Minimal Web Speech API surface (not in lib.dom for every browser). Only used with `?ff=voice`. */
interface Recognition {
  lang: string
  interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}
type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function MicIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#FF6E01" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}

function ArrowIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

export interface ComposerProps {
  onSend: (text: string) => void
  /** A turn is streaming or there is no session yet: typing works, sending waits. */
  disabled: boolean
  /** 'dark' = the persistent bottom pill; 'light' = the in-card composer of the first card (C2). */
  tone?: 'dark' | 'light'
  placeholder?: string
  label?: string
}

/** Free-text composer (spec §2.1). "Say it" is visible everywhere but only works with `?ff=voice`. */
export function Composer({
  onSend,
  disabled,
  tone = 'dark',
  placeholder = 'Or ask the fitter anything…',
  label = 'Message the fitter',
}: ComposerProps) {
  const [draft, setDraft] = useState('')
  const [listening, setListening] = useState(false)
  const rec = useRef<Recognition | null>(null)
  const inputId = useId()
  const voice = hasFlag('voice') && recognitionCtor() !== null
  const light = tone === 'light'

  const send = () => {
    const t = draft.trim()
    if (!t || disabled) return
    setDraft('')
    onSend(t)
  }

  const toggleVoice = () => {
    if (rec.current) {
      rec.current.stop()
      return
    }
    const Ctor = recognitionCtor()
    if (!Ctor) return
    const r = new Ctor()
    r.lang = 'en-GB'
    r.interimResults = true
    r.onresult = (e) => setDraft(Array.from(e.results, (res) => res[0]?.transcript ?? '').join(''))
    r.onend = () => {
      rec.current = null
      setListening(false)
    }
    rec.current = r
    setListening(true)
    r.start()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        send()
      }}
      className={cn(
        'flex items-center rounded-full',
        light
          ? 'h-16 gap-2.5 border border-grey-c8 bg-white pr-2.5 pl-[26px] focus-within:border-midnight'
          : 'h-[60px] gap-2.5 border border-grey-2a bg-grey-14 pr-2 pl-[22px] focus-within:border-grey-5f',
      )}
    >
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        autoComplete="off"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        className={cn(
          'h-full min-w-0 flex-1 border-0 bg-transparent font-sans font-normal outline-none focus-visible:outline-none',
          light ? 'text-[20px] text-midnight placeholder:text-grey-6b' : 'text-[17px] text-washed-white placeholder:text-grey-8f',
        )}
      />
      <button
        type="button"
        disabled={!voice}
        aria-pressed={voice ? listening : undefined}
        title={voice ? undefined : 'Voice is coming soon'}
        onClick={toggleVoice}
        className={cn(
          'inline-flex flex-none cursor-pointer items-center rounded-full border-0 font-display font-bold uppercase text-washed-white transition-ui disabled:cursor-not-allowed disabled:opacity-50',
          light
            ? 'h-[52px] gap-2.5 bg-midnight pr-[22px] pl-[18px] text-[18px] tracking-[0.04em]'
            : 'h-11 gap-2 bg-grey-26 pr-4 pl-3 text-[15px] tracking-[0.05em]',
          listening && 'shadow-[inset_0_0_0_2px_#FF6E01]',
        )}
      >
        <MicIcon size={light ? 20 : 18} />
        {listening ? 'Listening' : 'Say it'}
      </button>
      <button
        type="submit"
        aria-label="Send"
        disabled={disabled || !draft.trim()}
        className={cn(
          'inline-flex flex-none cursor-pointer items-center justify-center rounded-full border-0 transition-ui disabled:cursor-not-allowed',
          light
            ? 'size-[52px] bg-tiger-orange hover:bg-orange-hover disabled:opacity-60'
            : 'size-11 bg-grey-3d enabled:hover:bg-grey-5f disabled:opacity-60',
        )}
      >
        <ArrowIcon size={light ? 22 : 18} color={light ? '#0B0B0B' : '#F8F8F8'} />
      </button>
    </form>
  )
}
