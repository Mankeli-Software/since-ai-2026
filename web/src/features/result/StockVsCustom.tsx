import { Button } from '@/components/ui/button'

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
    <section className="flex flex-col gap-3">
      <p className="font-semibold">{p.question}</p>
      {p.reasons.length > 0 && (
        <ul className="list-disc pl-5 text-sm">
          {p.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-3">
        {opts.map((o) => (
          <div
            key={o.id}
            className={`flex flex-col gap-2 rounded-lg border p-3 ${p.picked === o.id ? 'border-accent bg-muted' : 'border-border'}`}
          >
            <span className="font-display text-xl uppercase">{o.title}</span>
            <span className="text-sm">{o.line}</span>
            <Button
              variant={p.picked === o.id ? 'default' : 'secondary'}
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
