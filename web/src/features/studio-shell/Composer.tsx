import { useId, useState } from 'react'
import { useVoice, voiceAvailable } from '@/features/voice/store'
import { cn } from '@/lib/utils'

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

/**
 * Free-text composer (spec §2.1). "Say it" works in browsers that can listen (`?ff=novoice` turns it off):
 * it starts the hands-free voice conversation (features/voice), and tapping it again ends it.
 * Phones (M-02): a 48px pill with an icon-only round mic.
 */
export function Composer({
  onSend,
  disabled,
  tone = 'dark',
  placeholder = 'Or ask the fitter anything…',
  label = 'Message the fitter',
}: ComposerProps) {
  const [draft, setDraft] = useState('')
  const listening = useVoice((s) => s.on)
  const toggleVoice = useVoice((s) => s.toggle)
  const inputId = useId()
  const voice = voiceAvailable()
  const light = tone === 'light'

  const send = () => {
    const t = draft.trim()
    if (!t || disabled) return
    setDraft('')
    onSend(t)
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
          ? 'h-16 gap-2.5 border border-grey-c8 bg-white pr-2.5 pl-[26px] focus-within:border-midnight max-md:h-14 max-md:gap-1.5 max-md:pr-1.5 max-md:pl-4'
          : 'h-[60px] gap-2.5 border border-grey-2a bg-grey-14 pr-2 pl-[22px] focus-within:border-grey-5f max-md:h-12 max-md:gap-1 max-md:pr-0.5 max-md:pl-4',
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
          light
            ? 'text-[20px] text-midnight placeholder:text-grey-6b max-md:text-[16px]'
            : 'text-[17px] text-washed-white placeholder:text-grey-8f max-md:text-[16px]',
        )}
      />
      <button
        type="button"
        disabled={!voice}
        aria-pressed={voice ? listening : undefined}
        aria-label={listening ? 'End voice' : 'Say it'}
        title={voice ? (listening ? 'End the voice conversation' : 'Talk with the fitter, hands free') : 'Voice needs Chrome, Edge or Safari'}
        onClick={toggleVoice}
        className={cn(
          'inline-flex flex-none cursor-pointer items-center rounded-full border-0 font-display font-bold uppercase text-washed-white transition-ui disabled:cursor-not-allowed disabled:opacity-50',
          light
            ? 'h-[52px] gap-2.5 bg-midnight pr-[22px] pl-[18px] text-[18px] tracking-[0.04em] max-md:size-11 max-md:justify-center max-md:p-0'
            : 'h-11 gap-2 bg-grey-26 pr-4 pl-3 text-[15px] tracking-[0.05em] max-md:size-11 max-md:justify-center max-md:p-0',
          listening && 'shadow-[inset_0_0_0_2px_#FF6E01]',
        )}
      >
        <MicIcon size={light ? 20 : 18} />
        <span className="max-md:hidden">{listening ? 'End voice' : 'Say it'}</span>
      </button>
      <button
        type="submit"
        aria-label="Send"
        disabled={disabled || !draft.trim()}
        className={cn(
          'inline-flex flex-none cursor-pointer items-center justify-center rounded-full border-0 transition-ui disabled:cursor-not-allowed',
          light
            ? 'size-[52px] bg-tiger-orange hover:bg-orange-hover disabled:opacity-60 max-md:size-11'
            : 'size-11 bg-grey-3d enabled:hover:bg-grey-5f disabled:opacity-60',
        )}
      >
        <ArrowIcon size={light ? 22 : 18} color={light ? '#0B0B0B' : '#F8F8F8'} />
      </button>
    </form>
  )
}
