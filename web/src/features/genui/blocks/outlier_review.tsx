import { Button } from '@/components/ui/button'
import type { BlockProps } from '../types'

export const type = 'outlier_review'

const LABELS: Record<string, string> = {
  club_speed_mph: 'Club speed (mph)', carry_avg_yd: 'Carry average (yd)', claimed_carry_yd: 'Your number (yd)', n: 'Shots',
}

type Flag = BlockProps<'outlier_review'>['block']['flags'][number]

// Plain words from numbers only. The chat message carries the explanation.
function describe(f: Flag) {
  const parts = [f.shot_index != null ? `Shot ${f.shot_index + 1}` : 'Import', f.field ?? f.code]
  let s = parts.join(': ')
  if (f.value != null) s += ` is ${f.value}`
  if (f.expected) s += `, expected ${f.expected}`
  return s
}

export function Component({ block, interactive, answer, busy, respond }: BlockProps<'outlier_review'>) {
  const off = !interactive || busy
  const codes = block.flags.map((f) => f.code)
  const suggested = block.flags.find((f) => f.suggested_value != null)?.suggested_value
  const label = (a: string) =>
    a === 'confirm_value' ? (suggested != null ? `Use measured ${suggested}` : 'Use measured value')
    : a === 'keep' ? 'Keep my number' : 'Exclude these shots'
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1 text-sm">
        {block.flags.map((f, i) => (
          <li key={i} className="rounded-md border border-border bg-background px-3 py-2">
            <strong>{f.code}</strong> {describe(f)}
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-4 gap-2 text-center">
        {Object.entries(block.shots_summary ?? {}).map(([k, v]) => (
          <div key={k} className="rounded-md bg-muted px-2 py-1">
            <dd className="text-lg font-bold">{v}</dd>
            <dt className="text-xs text-muted-foreground">{LABELS[k] ?? k}</dt>
          </div>
        ))}
      </dl>
      {interactive ? (
        <div className="flex flex-wrap gap-2">
          {block.actions.map((a) => (
            <Button key={a} variant={a === 'confirm_value' ? 'default' : 'secondary'} disabled={off} onClick={() => respond({ action: a, codes }, label(a))}>
              {label(a)}
            </Button>
          ))}
        </div>
      ) : (
        answer && <p className="text-sm">Answered: <strong>{answer.displayText}</strong></p>
      )}
    </div>
  )
}
