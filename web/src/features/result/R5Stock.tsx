import { useEffect, useRef, useState } from 'react'
import { api } from '@/api/client'
import type { components } from '@/api/schema.gen'
import { Eyebrow } from '@/components/studio'
import { hasFlag } from '@/lib/flags'
import { convertProseUnits, distanceValue, unitLabel } from '@/lib/units'
import { useSession } from '@/store/session'
import { useUnitsStore } from '@/store/units'
import { ResultsAside, ViewLink, useResultsChrome } from './chrome'
import { headLabel } from './compare/pair'
import { StockCustomCards, type Purchase } from './compare/StockCustomCards'
import { customDelta } from './specLabel'
import type { Spec } from './types'

type StockAdvice = components['schemas']['StockAdvice']

const ASIDE_FALLBACK = 'Custom pays off when your shots agree on it. Stock still plays fine if you would rather keep the returns.'
const CHIPS = ['Show me the toe strikes', 'What if I buy stock?']

/** The two builds of the selected head: custom keeps the fit's deltas; stock is the same club at standard length and lie. */
function builds(spec: Spec): Record<Purchase, Spec> {
  return {
    custom: { ...spec, purchase: 'custom' },
    stock: { ...spec, purchase: 'stock', lie_deg: 0, length_in: 0 },
  }
}

function NothingCustom({ spec }: { spec: Spec | null }) {
  const custom = spec?.purchase === 'custom'
  const delta = spec ? customDelta(spec) : []
  return (
    <section className="flex flex-col items-start gap-3 rounded-16 border border-page-line bg-panel p-8 max-md:p-5">
      <Eyebrow className="text-orange-on-page">Stock or custom</Eyebrow>
      <h1 className="m-0 font-display text-[44px] leading-[.9] font-extrabold uppercase max-md:text-[36px]">
        {custom ? 'Your fit is already custom.' : 'Stock fits you. Nothing custom needed.'}
      </h1>
      <p className="m-0 max-w-[560px] text-[17px] leading-[1.5] text-on-page-2">
        {custom
          ? `It's built to your spec${delta.length ? ` (${delta.join(', ')})` : ''}, so there's no stock-or-custom choice to make here.`
          : "Your shots don't point to a custom build, so you keep the quick delivery and the returns. This page only shows up when custom is really worth it."}
      </p>
      <ViewLink view="summary" className="text-[15px] font-semibold text-orange-on-page max-md:inline-flex max-md:min-h-11 max-md:items-center">
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
  const { data, buySpec, setBuySpec, selected } = useResultsChrome()
  const { sessionId } = useSession()
  const [advice, setAdvice] = useState<StockAdvice | null>(null)
  const [stayStock, setStayStock] = useState(false)
  const prevBuySpecRef = useRef<Spec | null>(null)
  const units = useUnitsStore((s) => s.units)

  const block = data.latest('stock_vs_custom')
  const best = data.best
  const ui = useSession((s) => s.ui)
  const respond = useSession((s) => s.respond)
  const pendingItem = [...ui].reverse().find((u) => u.block.type === 'stock_vs_custom' && u.interactive && !u.answered)

  const stockadv = !hasFlag('nostockadv')

  useEffect(() => {
    if (!stockadv || !sessionId) return
    let active = true
    api
      .GET('/api/sessions/{session_id}/stock-advice', {
        params: { path: { session_id: sessionId } },
      })
      .then(({ data: resData, error }) => {
        if (active && resData && !error) {
          setAdvice(resData)
        }
      })
      .catch(() => {
        // on error fall back to current behaviour
      })
    return () => {
      active = false
    }
  }, [stockadv, sessionId])

  if (!block || !best || !selected) {
    return <NothingCustom spec={selected ?? best} />
  }

  // /stock-advice is computed for state.best only (#221): its stock spec and flight deltas apply to the
  // runner-up only as "for the {best}", so they are labelled, and the stock build comes from the selected spec.
  const forBest = selected.head === best.head
  const forBestNote = forBest ? '' : ` (for the ${headLabel(best.head)})`
  const b = builds(selected)
  if (stockadv && advice?.stock && forBest) {
    b.stock = advice.stock as Spec
  }

  const value: Purchase = buySpec?.purchase ?? selected.purchase
  const delta = customDelta(b.custom)
  const lieDelta = selected.lie_deg !== 0 && Math.abs(selected.lie_deg) <= 5
  const lean = stockadv && advice ? advice.lean : undefined

  return (
    <>
      <div className="flex items-center gap-3">
        <Eyebrow className="inline-flex h-[26px] items-center rounded-full bg-status-amber px-2.5 text-midnight">
          Only shown when custom is earned
        </Eyebrow>
      </div>
      <h1 className="m-0 font-display text-[56px] leading-[.88] font-extrabold uppercase max-md:text-[40px]">{block.question}</h1>
      {block.reasons && block.reasons.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[15px] text-on-page-2">
          {block.reasons.map((r) => (
            <li key={r} className="flex items-baseline gap-2">
              <span aria-hidden="true" className="inline-block size-1.5 flex-none translate-y-[-2px] rounded-full bg-on-page-3" />
              {convertProseUnits(r, units)}
            </li>
          ))}
        </ul>
      )}

      {stockadv && advice && (advice.lean === 'stock' || advice.lean === 'either') && (
        <div className="flex flex-col gap-1.5 rounded-12 border border-page-line-2 bg-panel p-4 text-[15px] text-on-page-2">
          <p className="m-0 font-medium text-on-page">
            Stock is a fine choice: you keep the {advice.stock_return_days}-day return. Custom builds cannot be returned.
          </p>
          {advice.reasons && advice.reasons.length > 0 && (
            <p className="m-0 text-on-page-2">{advice.reasons[0]}</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-on-page-3">
            {advice.lie_change_deg !== 0 && (
              <span>Lie change{forBestNote}: {advice.lie_change_deg > 0 ? `+${advice.lie_change_deg}°` : `${advice.lie_change_deg}°`}</span>
            )}
            {advice.carry_delta_yd != null && advice.carry_delta_yd !== 0 && (
              <span>Carry difference{forBestNote}: {`${advice.carry_delta_yd > 0 ? '+' : ''}${distanceValue(advice.carry_delta_yd, units, 1)} ${unitLabel('distance', units)}`}</span>
            )}
          </div>
        </div>
      )}

      {stockadv && advice && advice.stock && (
        <div className="flex flex-col gap-2 rounded-12 border border-page-line bg-panel p-3.5">
          <label className="flex cursor-pointer items-center gap-2.5 text-[15px] font-semibold text-on-page">
            <input
              type="checkbox"
              checked={stayStock}
              onChange={(e) => {
                const checked = e.target.checked
                setStayStock(checked)
                if (checked) {
                  prevBuySpecRef.current = buySpec
                  setBuySpec(b.stock)
                } else {
                  setBuySpec(prevBuySpecRef.current)
                }
              }}
              className="size-4 rounded accent-tiger-orange"
            />
            <span>What if I stay stock?</span>
          </label>
          {stayStock && advice.side_delta_yd != null && (
            <p className="m-0 text-[14px] text-on-page-2">
              {!forBest && <span className="text-on-page-3">For the {headLabel(best.head)}: </span>}
              {advice.side_delta_yd === 0
                ? 'Your start line stays on target.'
                : `With stock lie, your start line shifts about ${Math.abs(advice.side_delta_yd).toFixed(1)} yards to the ${advice.side_delta_yd > 0 ? 'right' : 'left'}.`}
            </p>
          )}
        </div>
      )}

      <StockCustomCards
        className="flex-[1_0_auto]"
        value={value}
        onChange={(v) => {
          if (stayStock) setStayStock(false)
          setBuySpec(b[v])
          if (pendingItem) {
            void respond(pendingItem.id, v, v === 'stock' ? 'Stock' : 'Custom')
          }
        }}
        stockTitle={lieDelta ? 'Stock, 0°' : 'Stock'}
        customTitle={delta.length ? `Custom, ${delta.join(', ')}` : 'Custom build'}
        stockReturnDays={advice?.stock_return_days ?? block.stock_return_days ?? 30}
        customReturnable={block.custom_returnable ?? false}
        lean={lean}
      />
      <span className="text-[15px] text-on-page-2">
        Pick one. The buy bar below follows your choice. Not sure? Stock still plays fine for you.
        <span className="text-on-page-3"> The strike pictures are illustrations.</span>
      </span>
      <ResultsAside fallback={ASIDE_FALLBACK} chips={CHIPS} />
    </>
  )
}
