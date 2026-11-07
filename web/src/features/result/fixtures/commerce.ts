import type { Spec } from '../types'

/*
 * EXAMPLE commerce data (docs/ui-v3/TASKS.md, decision 4). Nothing here comes from a tool or the shop:
 * the price and the stock/delivery lines are design copy, labelled "Example" in the UI (title tooltips).
 * Replace with the catalog / host adapter once real prices and stock exist.
 */

/** Example price for one 7-iron head build, in euros. */
export const EXAMPLE_PRICE_EUR = 679
export const EXAMPLE_PRICE_TOOLTIP = 'Example price'

export const formatPrice = (eur: number) => `€${eur.toLocaleString('en-IE')}`

export interface PurchaseCopy {
  /** Status dot colour. */
  tone: 'green' | 'amber'
  /** Buy bar status line. */
  status: string
  /** The three ticks under the R1 hero. */
  ticks: [string, string, string]
}

export const PURCHASE_COPY: Record<Spec['purchase'], PurchaseCopy> = {
  stock: {
    tone: 'green',
    status: 'Stock build, in stock, ships in 2–3 days. 30-day returns.',
    ticks: ['Stock build fits you', 'Ships in 2–3 days', '30-day returns'],
  },
  custom: {
    tone: 'amber',
    status: 'Custom build, ships in about 2 weeks. Built for you, not returnable.',
    ticks: ['Custom build, made for you', 'Ships in about 2 weeks', 'Built to your spec'],
  },
}

export const STATUS_TOOLTIP = 'Example stock and delivery'

/*
 * EXAMPLE projection for the R1b "Confirm it with real shots" bar: where confidence usually lands after
 * a short simulator session. Not computed for this golfer; shown with a "~" and an "Example" tooltip.
 */
export const EXAMPLE_PROJECTED_CONFIDENCE = 0.92
export const CONFIRM_COPY = '10 shots with a 7-iron, about 15 minutes. I check the shaft and head against what you really hit.'
