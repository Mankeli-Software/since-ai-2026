import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { UiItem } from '@/store/session'
import { GenUiBlock } from '../genui/GenUiBlock'
import { promptOf } from './RecapRow'

/** The light conversation card surface (spec §2.1): #F8F8F8, radius 20, padding 26/30/28, gap 18. Phones (M-04c): radius 18, 18/16. */
export const cardSurface =
  'flex min-w-0 flex-col gap-[18px] rounded-20 bg-washed-white px-[30px] pt-[26px] pb-7 text-midnight shadow-card max-md:gap-3.5 max-md:rounded-18 max-md:px-4 max-md:py-[18px]'

/** A display-only block (no input) on a light card, e.g. below the fitter line. */
export function DisplayCard({ item, className }: { item: UiItem; className?: string }) {
  return (
    <section className={cn(cardSurface, className)} aria-label={promptOf(item)}>
      <GenUiBlock id={item.id} block={item.block} interactive={false} busy={false} respond={() => {}} />
    </section>
  )
}

export interface ConversationCardProps {
  /** The one interactive, unanswered block. */
  item: UiItem
  /** Display blocks from the same turn (e.g. `confidence_update`): shown above the input. */
  above: UiItem[]
  busy: boolean
  respond: (id: string, value: unknown, displayText: string) => void
  /** Extra content at the bottom of the card (the C2 in-card composer). */
  footer?: ReactNode
}

/**
 * The single input card. Exactly one is on screen; the block renders its own options and submit
 * button(s) and handles number keys itself (useNumberKeys).
 */
export function ConversationCard({ item, above, busy, respond, footer }: ConversationCardProps) {
  return (
    <section className={cardSurface} aria-label={promptOf(item) ?? 'Your answer'}>
      {above.map((d) => (
        <GenUiBlock key={d.id} id={d.id} block={d.block} interactive={false} busy={false} respond={() => {}} />
      ))}
      <GenUiBlock
        // Remount per card so block-local state (picked token, slider value) never leaks between cards.
        key={item.id}
        id={item.id}
        block={item.block}
        interactive
        answer={item.answer}
        busy={busy}
        respond={(v, d) => respond(item.id, v, d)}
      />
      {footer}
    </section>
  )
}
