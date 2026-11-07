import { FlexBandView } from '@/features/result/views/FlexBandView'
import type { BlockProps } from '../types'

export const type = 'flex_band'

/**
 * Display: L/R/S/X flex bands with the measured marker and the guess ghost (R2, K5).
 * The block renders light (chat card); the R2 results view reuses `FlexBandView` with `tone="dark"`.
 */
export function Component({ block }: BlockProps<'flex_band'>) {
  return (
    <FlexBandView
      tone="light"
      measured_mph={block.measured_mph}
      band={block.band}
      ghost_mph={block.ghost_mph}
      ghost_label={block.ghost_label}
    />
  )
}
