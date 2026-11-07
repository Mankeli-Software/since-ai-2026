import { FitterAvatar } from '@/components/studio'
import type { ChatMessage } from '@/store/session'
import { Text } from '../chat/Text'

/**
 * The fitter's latest line (spec §2.1): avatar 44 + Barlow 500 24px/1.45, `**bold**` for key facts.
 * Each further message of the same turn is its own paragraph, indented to the text column.
 */
export function FitterLine({ messages }: { messages: ChatMessage[] }) {
  const lines = messages.filter((m) => m.text.trim())
  if (lines.length === 0) return null
  const [first, ...rest] = lines
  const p = 'text-[24px] font-medium leading-[1.45] text-washed-white [&_strong]:font-bold'
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <div className="flex items-start gap-4">
        <FitterAvatar size={44} />
        <p className={`mt-1.5 mb-0 ${p}`}>
          <span className="sr-only">Fitter: </span>
          <Text text={first.text.trim()} />
        </p>
      </div>
      {rest.map((m) => (
        <p key={m.id} className={`mt-0 mb-0 ml-[60px] ${p}`}>
          <Text text={m.text.trim()} />
        </p>
      ))}
    </div>
  )
}

/** Subtle "Thinking…" while a turn streams and no card is up yet. */
export function Thinking() {
  return (
    <p role="status" className="m-0 ml-[60px] flex items-center gap-1.5 text-grey-a3">
      <span className="sr-only">Running the numbers…</span>
      {[0, 160, 320].map((d) => (
        <span
          key={d}
          aria-hidden="true"
          className="size-2 animate-pulse rounded-full bg-grey-8f"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </p>
  )
}
