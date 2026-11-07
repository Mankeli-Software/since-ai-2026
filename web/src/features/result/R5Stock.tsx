import { Eyebrow } from '@/components/studio'
import { useSession } from '@/store/session'
import { ResultsAside, ViewLink, useResultsChrome } from './chrome'
import { StockCustomCards, type Purchase } from './compare/StockCustomCards'
import { customDelta } from './specLabel'
import type { Spec } from './types'

const ASIDE_FALLBACK = 'Custom pays off when your shots agree on it. Stock still plays fine if you would rather keep the returns.'
const CHIPS = ['Show me the toe strikes', 'What if I buy stock?']

/** The two builds: custom keeps the fit's deltas; stock is the same club at standard length and lie. */
function builds(best: Spec): Record<Purchase, Spec> {
  return {
    custom: { ...best, purchase: 'custom' },
    stock: { ...best, purchase: 'stock', lie_deg: 0, length_in: 0 },
  }
}

function NothingCustom({ best }: { best: Spec | null }) {
  const custom = best?.purchase === 'custom'
  const delta = best ? customDelta(best) : []
  return (
    <section className="flex flex-col items-start gap-3 rounded-16 border border-grey-26 bg-grey-12 p-8 max-md:p-5">
      <Eyebrow className="text-orange-hover">Stock or custom</Eyebrow>
      <h1 className="m-0 font-display text-[44px] leading-[.9] font-extrabold uppercase max-md:text-[36px]">
        {custom ? 'Your fit is already custom.' : 'Stock fits you. Nothing custom needed.'}
      </h1>
      <p className="m-0 max-w-[560px] text-[17px] leading-[1.5] text-grey-c8">
        {custom
          ? `It's built to your spec${delta.length ? ` (${delta.join(', ')})` : ''}, so there's no stock-or-custom choice to make here.`
          : "Your shots don't point to a custom build, so you keep the quick delivery and the returns. This page only shows up when custom is really worth it."}
      </p>
      <ViewLink view="summary" className="text-[15px] font-semibold text-orange-hover max-md:inline-flex max-md:min-h-11 max-md:items-center">
        ← Back to your fit
      </ViewLink>
    </section>
  )
}

/**
 * R5 "Custom is earned" (V3-R5-Stock). Only meaningful when a stock_vs_custom block arrived; otherwise an
 * honest "stock fits" panel. The radio drives the buy bar through setBuySpec.
 */
export function R5Stock() {
  const { data, buySpec, setBuySpec } = useResultsChrome()
  const block = data.latest('stock_vs_custom')
  const best = data.best
  const ui = useSession((s) => s.ui)
  const respond = useSession((s) => s.respond)
  const pendingItem = [...ui].reverse().find((u) => u.block.type === 'stock_vs_custom' && u.interactive && !u.answered)

  if (!block || !best) {
    return <NothingCustom best={best} />
  }

  const b = builds(best)
  const value: Purchase = buySpec?.purchase ?? best.purchase
  const delta = customDelta(b.custom)
  const lieDelta = best.lie_deg !== 0 && Math.abs(best.lie_deg) <= 5

  return (
    <>
      <div className="flex items-center gap-3">
        <Eyebrow className="inline-flex h-[26px] items-center rounded-full bg-status-amber px-2.5 text-midnight">
          Only shown when custom is earned
        </Eyebrow>
      </div>
      <h1 className="m-0 font-display text-[56px] leading-[.88] font-extrabold uppercase max-md:text-[40px]">{block.question}</h1>
      {block.reasons && block.reasons.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[15px] text-grey-c8">
          {block.reasons.map((r) => (
            <li key={r} className="flex items-baseline gap-2">
              <span aria-hidden="true" className="inline-block size-1.5 flex-none translate-y-[-2px] rounded-full bg-grey-8f" />
              {r}
            </li>
          ))}
        </ul>
      )}
      <StockCustomCards
        className="flex-[1_0_auto]"
        value={value}
        onChange={(v) => {
          setBuySpec(b[v])
          if (pendingItem) {
            void respond(pendingItem.id, v, v === 'stock' ? 'Stock' : 'Custom')
          }
        }}
        stockTitle={lieDelta ? 'Stock, 0°' : 'Stock'}
        customTitle={delta.length ? `Custom, ${delta.join(', ')}` : 'Custom build'}
        stockReturnDays={block.stock_return_days ?? 30}
        customReturnable={block.custom_returnable ?? false}
      />
      <span className="text-[15px] text-grey-a3">
        Pick one. The buy bar below follows your choice. Not sure? Stock still plays fine for you.
        <span className="text-grey-8f"> The strike pictures are illustrations.</span>
      </span>
      <ResultsAside fallback={ASIDE_FALLBACK} chips={CHIPS} />
    </>
  )
}
