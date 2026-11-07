import { useState } from 'react'
import { Eyebrow, RecapChip } from '@/components/studio'
import { cn } from '@/lib/utils'
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

/**
 * "You told me" (spec §2.1): the last 3 answered input cards as dark chips, oldest first.
 * Phones (M-00 rule 3, M-04c): folds into one chip with the latest answer and "+N"; tap to show them all.
 */
export function RecapRow({ items }: { items: UiItem[] }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  const latest = items[items.length - 1]
  const more = items.length - 1
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 max-w-full cursor-pointer items-center gap-2 self-start rounded-full border border-page-line bg-panel-2 px-3.5 font-sans text-[14px] font-medium text-on-page-2 md:hidden"
      >
        <span className="flex-none text-on-page-3">Logged so far</span>
        <span className="truncate text-on-page">{latest.answer?.displayText ?? ''}</span>
        {more > 0 && (
          <span className="inline-flex h-[22px] min-w-[22px] flex-none items-center justify-center rounded-full bg-page-line px-1 text-[12px] font-semibold">
            +{more}
          </span>
        )}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-on-page-3,#8f8f8f)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn('flex-none transition-ui', open && 'rotate-180')}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div className={cn('flex flex-wrap items-center gap-2', !open && 'max-md:hidden')}>
        <Eyebrow className="mr-1.5 text-on-page-3 max-md:hidden">Logged so far</Eyebrow>
        {items.map((u) => (
          <RecapChip key={u.id} label={u.answer?.displayText ?? ''} title={promptOf(u)} measured={isMeasured(u)} />
        ))}
      </div>
    </>
  )
}
