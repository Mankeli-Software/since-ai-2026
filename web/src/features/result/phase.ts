import type { FittingState } from '@/api/client'
import type { UiItem } from '@/store/session'

/** v3: the studio switches from the chat shell to the results shell once a fit exists and the card has arrived. */
export function isResultPhase(state: FittingState | null, ui: UiItem[]): boolean {
  return state?.best != null && ui.some((u) => u.block.type === 'recommendation_card')
}
