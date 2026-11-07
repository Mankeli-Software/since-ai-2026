import { useState } from 'react'
import { Button, ClubImage } from '@/components/studio'
import { host } from '@/host/standalone'
import { cn } from '@/lib/utils'
import { ExamplePill } from './chrome'
import { EXAMPLE_PRICE_EUR, EXAMPLE_PRICE_TOOLTIP, PURCHASE_COPY, STATUS_TOOLTIP, formatPrice } from './fixtures/commerce'
import { specTitle } from './specLabel'
import type { Spec } from './types'

export interface BuyBarProps {
  /** The build to buy (data.best, or the R5 choice). Null while the fit is still loading. */
  spec: Spec | null
  /** Portal target for the optional "Next: … →" link (ResultsNext). */
  nextRef: (el: HTMLElement | null) => void
}

/** Always-visible buy bar (spec §2.2): club, spec line, stock/custom status, optional Next link, price, Add to cart. */
export function BuyBar({ spec, nextRef }: BuyBarProps) {
  const [cart, setCart] = useState<{ state: 'idle' | 'busy' | 'done'; message?: string }>({ state: 'idle' })
  const copy = spec ? PURCHASE_COPY[spec.purchase] : null

  const add = async () => {
    if (!spec) return
    setCart({ state: 'busy' })
    const r = await host.addToCart([
      {
        variantId: `${spec.head}/${spec.shaft}`,
        quantity: 1,
        properties: {
          head: spec.head,
          shaft: spec.shaft,
          flex: spec.flex,
          length_in: String(spec.length_in),
          lie_deg: String(spec.lie_deg),
          grip: spec.grip,
          handedness: spec.handedness,
          purchase: spec.purchase,
        },
      },
    ])
    setCart({ state: 'done', message: r.ok ? (r.message ?? 'Added to cart') : (r.message ?? 'Could not add to cart') })
  }

  return (
    <div className="flex flex-none items-center gap-4 border-t border-grey-26 bg-grey-0e px-10 py-3">
      {spec && <ClubImage slug={spec.head} className="h-[52px] w-auto flex-none" />}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-display text-[20px] font-bold uppercase">{spec ? specTitle(spec) : 'Your fit'}</span>
        {copy && (
          <span title={STATUS_TOOLTIP} className="inline-flex min-w-0 items-center gap-2 text-[14px] text-grey-a3">
            <span
              aria-hidden="true"
              className={cn('size-2 flex-none rounded-full', copy.tone === 'green' ? 'bg-status-green' : 'bg-status-amber')}
            />
            <span className="line-clamp-2">{copy.status}</span>
            <ExamplePill />
          </span>
        )}
      </span>
      <span className="ml-auto flex flex-none items-center gap-[18px]">
        <span ref={nextRef} className="contents" />
        {/* Example price (fixtures/commerce.ts), not from the shop. */}
        <span title={EXAMPLE_PRICE_TOOLTIP} className="inline-flex items-center gap-2 font-display text-[32px] font-extrabold tabular-nums">
          <span>{formatPrice(EXAMPLE_PRICE_EUR)}</span>
          <ExamplePill />
          <span className="sr-only"> (example price)</span>
        </span>
        <Button variant="primary" size="lg" disabled={!spec || cart.state === 'busy'} onClick={() => void add()}>
          {cart.state === 'done' ? 'Added' : 'Add to cart'}
        </Button>
        <span role="status" className="sr-only">
          {cart.message ?? ''}
        </span>
      </span>
    </div>
  )
}
