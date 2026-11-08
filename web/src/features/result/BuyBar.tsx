import { useState } from 'react'
import { Button, ClubImage } from '@/components/studio'
import { host } from '@/host/standalone'
import { cn } from '@/lib/utils'
import { ExamplePill } from './chrome'
import { EXAMPLE_PRICE_EUR, EXAMPLE_PRICE_TOOLTIP, PURCHASE_COPY, STATUS_TOOLTIP, formatPrice } from './fixtures/commerce'
import { specTitle } from './specLabel'
import type { Spec } from './types'

export interface BuyBarProps {
  /** The build to buy (the selected head, or the R5 choice). Null while the fit is still loading. */
  spec: Spec | null
  /** Portal target for the optional "Next: … →" link (ResultsNext). */
  nextRef: (el: HTMLElement | null) => void
}

/**
 * Always-visible buy bar (spec §2.2): club, spec line, stock/custom status, optional Next link, price, Add to cart.
 * Phones (M-R1): name + one status line on the left, the price inside the Add to cart button; no image, no Next link.
 */
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
    <div data-surface="dark" className="flex flex-none items-center gap-4 border-t border-grey-26 bg-grey-0e px-10 py-3 max-md:gap-2.5 max-md:px-4 max-md:pt-2.5 max-md:pb-[18px]">
      {spec && <ClubImage slug={spec.head} className="h-[52px] w-auto flex-none max-md:hidden" />}
      <span className="flex min-w-0 flex-col gap-0.5 max-md:flex-1">
        <span className="truncate font-display text-[20px] font-bold uppercase max-md:text-[16px]">{spec ? specTitle(spec) : 'Your fit'}</span>
        {copy && (
          <span title={STATUS_TOOLTIP} className="inline-flex min-w-0 items-center gap-2 text-[14px] text-grey-a3 max-md:gap-1.5 max-md:text-[13px]">
            <span
              aria-hidden="true"
              className={cn('size-2 flex-none rounded-full', copy.tone === 'green' ? 'bg-status-green' : 'bg-status-amber')}
            />
            <span className="line-clamp-2 max-md:truncate">{copy.status}</span>
            <ExamplePill />
          </span>
        )}
      </span>
      <span className="ml-auto flex flex-none items-center gap-[18px]">
        <span className="contents max-md:hidden">
          <span ref={nextRef} className="contents" />
        </span>
        {/* Example price (fixtures/commerce.ts), not from the shop. */}
        <span title={EXAMPLE_PRICE_TOOLTIP} className="inline-flex items-center gap-2 font-display text-[32px] font-extrabold tabular-nums max-md:hidden">
          <span>{formatPrice(EXAMPLE_PRICE_EUR)}</span>
          <ExamplePill />
          <span className="sr-only"> (example price)</span>
        </span>
        <Button
          variant="primary"
          size="lg"
          disabled={!spec || cart.state === 'busy'}
          onClick={() => void add()}
          className="max-md:min-h-[52px] max-md:gap-2 max-md:px-4 max-md:text-[18px]"
        >
          <span title={EXAMPLE_PRICE_TOOLTIP} className="tabular-nums md:hidden">
            {formatPrice(EXAMPLE_PRICE_EUR)}
            <span className="sr-only"> (example price)</span>
          </span>
          <span aria-hidden="true" className="h-[18px] w-px bg-black/25 md:hidden" />
          {cart.state === 'done' ? 'Added' : 'Add to cart'}
        </Button>
        <span role="status" className="sr-only">
          {cart.message ?? ''}
        </span>
      </span>
    </div>
  )
}
