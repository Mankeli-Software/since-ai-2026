import { Eyebrow, RecapChip } from '@/components/studio'
import type { UiItem } from '@/store/session'

/** The question a block asked, for the chip's tooltip. */
export function promptOf(u: UiItem): string | undefined {
  if (u.block.type === 'heard_summary') return "Here's what I heard"
  return 'prompt' in u.block && typeof u.block.prompt === 'string' ? u.block.prompt : undefined
}

/** Solid = measured: a slider answered as "I measured it", or shots that came in from an import. */
function isMeasured(u: UiItem): boolean {
  const v = u.answer?.value
  if (v === null || typeof v !== 'object') return false
  if (u.block.type === 'slider') return (v as { measured?: unknown }).measured === true
  if (u.block.type === 'data_import') return !('skipped' in v)
  return false
}

/** "You told me" (spec §2.1): the last 3 answered input cards as dark chips, oldest first. */
export function RecapRow({ items }: { items: UiItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Eyebrow className="mr-1.5 text-grey-5f">Logged so far</Eyebrow>
      {items.map((u) => (
        <RecapChip key={u.id} label={u.answer?.displayText ?? ''} title={promptOf(u)} measured={isMeasured(u)} />
      ))}
    </div>
  )
}
