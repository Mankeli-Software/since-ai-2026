import type { Spec } from '../types'

/*
 * EXAMPLE availability lines for the R3 head selector (docs/ui-v3/TASKS.md, decision 4). Design copy, not
 * shop data: shown with an "Example stock and delivery" tooltip and an sr-only "(example)". Keyed by
 * "<head>/<shaft>"; anything not listed gets the in-stock line. Replace with the host adapter's stock API.
 * Lives next to fixtures/commerce.ts's PURCHASE_COPY; move it there when the commerce fixture is merged.
 */

export interface Availability {
  tone: 'green' | 'amber'
  text: string
}

const IN_STOCK: Availability = { tone: 'green', text: 'In stock, ships in 2–3 days' }

const EXAMPLES: Record<string, Availability> = {
  '201-mkii/kbs-tour-lite-regular': {
    tone: 'amber',
    text: 'Tour Lite R sold out until Dec. In stock with KBS Tour R (120 g)',
  },
}

export function exampleAvailability(head: string, shaft: Spec['shaft'] | undefined): Availability {
  return (shaft && EXAMPLES[`${head}/${shaft}`]) || IN_STOCK
}
