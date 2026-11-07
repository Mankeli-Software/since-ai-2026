import { ResultsNext } from './chrome'
import { ViewPlaceholder } from './ViewPlaceholder'

/** R3 "Compare heads, see it fly" (V3-R3-Compare). PLACEHOLDER: task T4b replaces this file. */
export function R3Compare() {
  return (
    <>
      <ViewPlaceholder eyebrow="Compare heads" title="Swap the head, keep your shaft" note="Both heads on your shaft, side by side in flight. This screen is coming next." />
      <ResultsNext label="In your hands" to={{ view: 'ar' }} />
    </>
  )
}
