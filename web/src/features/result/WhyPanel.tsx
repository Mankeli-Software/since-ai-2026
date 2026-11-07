import { useState } from 'react'
import type { UIBlock } from '@/api/client'

type P = Extract<UIBlock, { type: 'why_panel' }>
type Item = P['items'][number]
type Depth = P['depth']

const label = (s: string) => s.replace(/_/g, ' ')

function sourceText(s: NonNullable<Item['sources']>[number]) {
  const base = s.note ?? label(s.source)
  return s.n && !base.includes(String(s.n)) ? `${base} (${s.n})` : base
}

export function WhyPanelView({ items, depth: initial }: { items: Item[]; depth: Depth }) {
  const [depth, setDepth] = useState<Depth>(initial)
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Why this build</h3>
        <div className="flex gap-1 text-xs">
          {(['beginner', 'standard', 'numbers'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDepth(d)}
              className={`rounded-full px-2 py-0.5 ${d === depth ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((it, i) => (
          <li key={i} className="flex flex-col gap-1 border-t border-border pt-2 text-sm first:border-t-0 first:pt-0">
            <span className="text-xs font-semibold uppercase text-muted-foreground">{label(it.part)}</span>
            <p>{it.plain}</p>
            {depth !== 'beginner' && Object.keys(it.numbers ?? {}).length > 0 && (
              <p className="text-xs text-muted-foreground">
                {Object.entries(it.numbers ?? {})
                  .slice(0, depth === 'numbers' ? undefined : 2)
                  .map(([k, v]) => `${label(k)}: ${v}`)
                  .join(' · ')}
              </p>
            )}
            {(it.sources ?? []).length > 0 && (
              <p className="text-xs text-muted-foreground">
                From {(it.sources ?? []).map(sourceText).join('; ')}
              </p>
            )}
            {it.close_call && (
              <p className="rounded-md border border-accent bg-muted p-2 text-xs">
                <strong>Close call:</strong> {String(it.close_call.ours)}
                {it.close_call.alt != null && <> vs {String(it.close_call.alt)}</>}, {Math.round(it.close_call.share * 100)}% for ours.
                {it.close_call.next_step && <> {it.close_call.next_step}</>}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
