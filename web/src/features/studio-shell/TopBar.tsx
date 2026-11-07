import { Button } from '@/components/ui/button'
import { Mascot } from '../mascot/Mascot'
import { useSession } from '@/store/session'

const GATE: Record<string, string> = {
  needs_info: 'Needs info',
  no_result: 'No result yet',
  provisional: 'Provisional',
  confident: 'Confident',
}

/** Always visible; driven only by FittingState (highest version wins, see store/session.ts). */
export function TopBar() {
  const { state, demo, mascot, busy, saved, say, save } = useSession()
  const pct = state?.confidence == null ? null : Math.round(state.confidence * 100)
  const best = state?.best
  const missing = state?.missing?.length ?? 0
  const gate = state ? (GATE[state.gate] ?? state.gate) : '-'

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
            {state?.strength === 'low' && ' (low)'}
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
      {missing > 0 && <span className="text-sm text-ink-300">{missing} missing</span>}
      <div className="ml-auto flex items-center gap-3">
        {demo && <span className="border border-orange-300 px-2 py-0.5 font-display text-xs font-semibold uppercase tracking-wider text-orange-300">Simulated golfer</span>}
        <Button variant="outline" size="sm" className="border-border-dark bg-transparent text-washed-white hover:bg-surface-dark-2 hover:text-washed-white" disabled={busy || !state} onClick={() => void say('I want to add data')}>
          Add data
        </Button>
        <Button size="sm" className="bg-accent text-accent-foreground hover:bg-orange-300" disabled={!state} onClick={() => void save()}>
          Save
        </Button>
        {saved && (
          <span className="text-xs text-ink-300" role="status">
            {saved.status === 'ok' ? 'Saved' : 'Save is not available yet'}
          </span>
        )}
      </div>
    </header>
  )
}
