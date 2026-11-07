import { Button } from '@/components/ui/button'
import { btnCls, eyebrowCls, promptCls } from '../genui/ui'

export function StockVsCustomView(p: {
  question: string
  reasons: string[]
  stockReturnDays: number
  customReturnable: boolean
  locked: boolean
  picked?: string
  onPick: (v: 'stock' | 'custom') => void
}) {
  const opts = [
    {
      id: 'stock' as const,
      title: 'Stock',
      line: `Returnable within ${p.stockReturnDays} days.`,
    },
    {
      id: 'custom' as const,
      title: 'Custom',
      line: p.customReturnable ? 'Built to order.' : 'Built to order. Not returnable.',
    },
  ]
  return (
    <section className="flex flex-col gap-4">
      <p className={promptCls}>{p.question}</p>
      {p.reasons.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-ink-700 marker:text-ink-300">
          {p.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-3">
        {opts.map((o) => (
          <div
            key={o.id}
            className={`flex flex-col gap-2 rounded-lg border bg-card p-4 ${p.picked === o.id ? 'border-ink-900 ring-1 ring-ink-900' : 'border-border'}`}
          >
            <span className={eyebrowCls}>Option</span>
            <span className="font-display text-4xl font-semibold uppercase leading-none">{o.title}</span>
            <span className="mb-2 text-sm text-ink-700">{o.line}</span>
            <Button
              variant={p.picked === o.id ? 'default' : 'outline'}
              className={`mt-auto ${btnCls}`}
              disabled={p.locked}
              onClick={() => p.onPick(o.id)}
            >
              {p.picked === o.id ? `Chosen: ${o.title}` : `Choose ${o.title.toLowerCase()}`}
            </Button>
          </div>
        ))}
      </div>
    </section>
  )
}
