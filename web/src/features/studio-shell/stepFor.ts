import type { UIBlock } from '@/api/client'

/** Simulator brands: a `source_picker` offering any of these is the C4b "which simulator" card. */
const SIMULATORS = /trackman|foresight|gcquad|uneekor|skytrak|flightscope|launch.?monitor/i

/**
 * "Step N of 4" in the chat header, from the block on screen (spec §2.1 step mapping):
 * 1 = about you and scoring, 2 = evidence, 3 = body, 4 = everything heard (C2b).
 * Returns null for blocks that do not move the step (results, media), so the caller keeps the last one.
 */
export function stepFor(block: UIBlock | null | undefined): 1 | 2 | 3 | 4 | null {
  if (!block) return null
  switch (block.type) {
    case 'sentence_builder':
    case 'onboarding_card':
    case 'choice_chips':
    case 'slider':
      return 1
    case 'source_picker':
      return block.options.some((o) => SIMULATORS.test(o.id) || SIMULATORS.test(o.name)) ? 2 : 1
    case 'yes_no_fork':
    case 'data_import':
    case 'outlier_review':
    case 'confidence_update':
      return 2
    case 'body_measure':
      return 3
    case 'heard_summary':
      return 4
    default:
      return null
  }
}
