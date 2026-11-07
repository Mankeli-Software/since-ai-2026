import { ViewPlaceholder } from './ViewPlaceholder'

/**
 * R5 "Custom is earned" (V3-R5-Stock). PLACEHOLDER: task T4b replaces this file. Shown only when a
 * stock_vs_custom block arrived; the radio drives the buy bar through useResultsChrome().setBuySpec.
 */
export function R5Stock() {
  return <ViewPlaceholder eyebrow="Stock or custom" title="Stock or custom" note="Only shown when custom is earned. This screen is coming next." />
}
