import { useState } from 'react'
import type { UIBlock } from '@/api/client'
import { calloutCls, cardCls, chipCls, eyebrowCls } from '../genui/ui'

type P = Extract<UIBlock, { type: 'why_panel' }>
type Item = P['items'][number]
type Depth = P['depth']

const DEPTH_LABELS: Record<Depth, string> = {
  beginner: 'Summary',
  standard: 'Detailed',
  numbers: 'Spec Sheet',
}

const label = (s: string) => s.replace(/_/g, ' ')

function sourceText(s: NonNullable<Item['sources']>[number]) {
  const base = s.note ?? label(s.source)
  return s.n && !base.includes(String(s.n)) ? `${base} (${s.n})` : base
}

export function WhyPanelView({ items, depth: initial }: { items: Item[]; depth: Depth }) {
  const [depth, setDepth] = useState<Depth>(initial)
  return (
    <section className={cardCls}>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-2xl font-semibold uppercase leading-none">Why this build</h3>
        <div className="flex gap-1.5">
          {(['beginner', 'standard', 'numbers'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDepth(d)}
              className={`${chipCls(d === depth)} h-7 px-3 font-display text-xs font-semibold uppercase tracking-[0.1em]`}
            >
              {DEPTH_LABELS[d]}
            </button>
          ))}
        </div>
      </div>
      <ul className="flex flex-col">
        {items.map((it, i) => (
          <li key={i} className="flex flex-col gap-1.5 border-t border-border py-3 text-sm first:border-t-0 first:pt-0 last:pb-0">
            <span className={eyebrowCls}>{label(it.part)}</span>
            <p className="text-[15px] leading-snug">{it.plain}</p>
            {depth !== 'beginner' && Object.keys(it.numbers ?? {}).length > 0 && (
              <p className="font-display text-sm font-medium tracking-wide text-ink-600">
                {Object.entries(it.numbers ?? {})
                  .slice(0, depth === 'numbers' ? undefined : 2)
                  .map(([k, v]) => `${label(k)}: ${v}`)
                  .join(' · ')}
              </p>
            )}
            {(it.sources ?? []).length > 0 && (
              <p className="text-xs text-ink-500">
                From {(it.sources ?? []).map(sourceText).join('; ')}
              </p>
            )}
            {it.close_call && (
              <p className={calloutCls}>
                <strong className="font-display uppercase tracking-[0.1em] text-orange-ink">Close call</strong>{' '} {String(it.close_call.ours)}
                {it.close_call.alt != null && <> vs {String(it.close_call.alt)}</>}, {Math.round(it.close_call.share * 100)}% for our pick.
                {it.close_call.next_step && <> {it.close_call.next_step}</>}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
