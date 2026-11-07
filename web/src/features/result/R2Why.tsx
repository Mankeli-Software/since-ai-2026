import { ResultsNext, useResultsChrome } from './chrome'
import { ViewPlaceholder } from './ViewPlaceholder'

/** R2 "Why each part" (V3-R2-*). PLACEHOLDER: task T4a replaces this file (part list, chart, 3D focus, Next chain). */
export function R2Why() {
  const { part } = useResultsChrome()
  return (
    <>
      <ViewPlaceholder eyebrow={`Why each part · ${part}`} title="Why each part" note="Every spec with its reason. This screen is coming next." />
      <ResultsNext label="Compare heads" to={{ view: 'compare' }} />
    </>
  )
}
