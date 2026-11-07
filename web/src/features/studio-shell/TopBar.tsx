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
    <header className="flex h-14 shrink-0 items-center gap-6 border-b border-border bg-background px-4">
      <Mascot mood={mascot} className="size-9" />
      <div className="w-56" title={`Gate: ${gate}`}>
        <div className="flex justify-between text-xs">
          <span className="font-semibold">Confidence</span>
          <span>
            {pct == null ? '-' : `${pct}%`} · {gate}
            {state?.strength === 'low' && ' (low)'}
          </span>
        </div>
        <div className="mt-1 h-2 bg-secondary" role="progressbar" aria-valuenow={pct ?? undefined} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${pct ?? 0}%` }} />
        </div>
      </div>
      <div className="min-w-0 text-sm">
        <span className="text-muted-foreground">Best fit </span>
        <span className="font-semibold">{best ? best.head : 'not yet'}</span>
        {state?.runner_up && <span className="text-muted-foreground"> (then {state.runner_up.head})</span>}
      </div>
      {missing > 0 && <span className="text-sm text-muted-foreground">{missing} missing</span>}
      <div className="ml-auto flex items-center gap-3">
        {demo && <span className="border border-border bg-secondary px-2 py-0.5 text-xs font-semibold">Simulated golfer</span>}
        <Button variant="secondary" size="sm" disabled={busy || !state} onClick={() => void say('I want to add data')}>
          Add data
        </Button>
        <Button size="sm" disabled={!state} onClick={() => void save()}>
          Save
        </Button>
        {saved && (
          <span className="text-xs text-muted-foreground" role="status">
            {saved.status === 'ok' ? 'Saved' : 'Save is not available yet'}
          </span>
        )}
      </div>
    </header>
  )
}
