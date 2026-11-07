import { FitterAvatar } from '@/components/studio'
import type { ChatMessage } from '@/store/session'
import { RevealText } from '../chat/RevealText'

/**
 * The fitter's latest line (spec §2.1): avatar 44 + Barlow 500 24px/1.45, `**bold**` for key facts.
 * Each further message of the same turn is its own paragraph, indented to the text column.
 * Phones (M-02): avatar 32 and 18px text.
 */
export function FitterLine({ messages }: { messages: ChatMessage[] }) {
  const lines = messages.filter((m) => m.text.trim())
  if (lines.length === 0) return null
  const [first, ...rest] = lines
  const p = 'text-[24px] font-medium leading-[1.45] text-on-page [&_strong]:font-bold max-md:text-[18px] max-md:font-normal'
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <div className="flex items-start gap-4 max-md:gap-2.5">
        <FitterAvatar size={44} className="max-md:size-8!" />
        <p className={`mt-1.5 mb-0 max-md:mt-0.5 ${p}`}>
          <span className="sr-only">Fitter: </span>
          <RevealText text={first.text.trim()} animate={first.live} />
        </p>
      </div>
      {rest.map((m) => (
        <p key={m.id} className={`mt-0 mb-0 ml-[60px] max-md:ml-[42px] ${p}`}>
          <RevealText text={m.text.trim()} animate={m.live} />
        </p>
      ))}
    </div>
  )
}

/** Subtle "Thinking…" while a turn streams and no card is up yet. */
export function Thinking() {
  return (
    <p role="status" className="m-0 ml-[60px] flex max-md:ml-[42px] items-center gap-1.5 text-on-page-2">
      <span className="sr-only">Running the numbers…</span>
      {[0, 160, 320].map((d) => (
        <span
          key={d}
          aria-hidden="true"
          className="size-2 animate-pulse rounded-full bg-on-page-3"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </p>
  )
}
