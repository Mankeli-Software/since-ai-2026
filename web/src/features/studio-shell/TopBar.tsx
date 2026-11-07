import { useState } from 'react'
import { ThemeToggle } from '@/components/studio'
import { Button } from '@/components/ui/button'
import { Mascot } from '../mascot/Mascot'
import { useSession } from '@/store/session'

const GATE: Record<string, string> = {
  needs_info: 'Dialing in',
  no_result: 'Not yet',
  provisional: 'Working fit',
  confident: 'Dialed in',
}

/** Always visible; driven only by FittingState (highest version wins, see store/session.ts). */
export function TopBar() {
  const { state, demo, mascot, busy, saved, mode, setMode, say, save } = useSession()
  const [email, setEmail] = useState('')
  const [copied, setCopied] = useState(false)
  const pct = state?.confidence == null ? null : Math.round(state.confidence * 100)
  const best = state?.best
  const missing = state?.missing?.length ?? 0
  const gate = state ? (GATE[state.gate] ?? state.gate) : '-'

  const copyLink = (url: string) => {
    const full = new URL(url, window.location.origin).href
    void navigator.clipboard.writeText(full)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-6 border-b border-border-dark bg-surface-dark px-5 text-washed-white">
      <div className="flex items-center gap-3">
        <Mascot mood={mascot} className="size-8" />
        <div className="flex items-baseline gap-2 font-display uppercase leading-none">
          <span className="text-xl font-bold tracking-[0.3em]">Takomo</span>
          <span className="text-sm font-medium tracking-[0.12em] text-ink-300">Fitter Studio</span>
        </div>
      </div>
      <div className="h-6 w-px bg-border-dark" />
      <div className="w-56" title={`Gate: ${gate}`}>
        <div className="flex justify-between font-display text-sm uppercase tracking-wider">
          <span className="font-semibold text-ink-300">Confidence</span>
          <span className="font-semibold">
            {pct == null ? '-' : `${pct}%`} · {gate}
            {state?.strength === 'low' && ' (rough)'}
          </span>
        </div>
        <div className="mt-1 h-1.5 bg-surface-dark-3" role="progressbar" aria-valuenow={pct ?? undefined} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${pct ?? 0}%` }} />
        </div>
      </div>
      <div className="min-w-0 text-sm">
        <span className="font-display uppercase tracking-wider text-ink-300">Best fit </span>
        <span className="font-display text-lg font-semibold uppercase tracking-wide">{best ? best.head : 'not yet'}</span>
        {state?.runner_up && <span className="text-ink-300"> (then {state.runner_up.head})</span>}
      </div>
      {missing > 0 && <span className="text-sm text-ink-300">{missing} specs to dial in</span>}
      <div className="ml-auto flex items-center gap-3">
        <div data-surface="dark">
          <ThemeToggle />
        </div>
        {demo && <span className="border border-orange-300 px-2 py-0.5 font-display text-xs font-semibold uppercase tracking-wider text-orange-300">Simulated golfer</span>}
        <Button
          variant="outline"
          size="sm"
          className="border-border-dark bg-transparent text-washed-white hover:bg-surface-dark-2 hover:text-washed-white"
          disabled={!state}
          onClick={() => setMode(mode === 'form' ? 'chat' : 'form')}
        >
          {mode === 'form' ? 'Chat mode' : 'Form mode'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-border-dark bg-transparent text-washed-white hover:bg-surface-dark-2 hover:text-washed-white"
          disabled={busy || !state}
          onClick={() => void say('I want to add data')}
        >
          Add shot data
        </Button>
        <div className="flex items-center gap-1.5">
          <input
            type="email"
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy || !state}
            className="h-8 w-28 rounded border border-border-dark bg-surface-dark-2 px-2 text-xs text-washed-white placeholder:text-ink-400 focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <Button size="sm" className="bg-accent text-accent-foreground hover:bg-orange-300" disabled={!state || busy} onClick={() => void save(email)}>
            Save
          </Button>
        </div>
        {saved && (
          <div className="flex items-center gap-1.5 text-xs text-ink-300" role="status">
            {saved.status === 'ok' ? (
              <>
                <span>Saved ·</span>
                {saved.resumeUrl && (
                  <>
                    <a href={saved.resumeUrl} className="text-orange-300 hover:underline">
                      Resume link
                    </a>
                    <button
                      type="button"
                      className="text-ink-400 hover:text-washed-white"
                      onClick={() => copyLink(saved.resumeUrl!)}
                    >
                      {copied ? '(Copied!)' : '(Copy)'}
                    </button>
                  </>
                )}
              </>
            ) : (
              'Save pending'
            )}
          </div>
        )}
      </div>
    </header>
  )
}
