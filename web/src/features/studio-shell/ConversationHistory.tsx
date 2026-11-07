import { useId, useState } from 'react'
import { FitterAvatar } from '@/components/studio'
import type { ChatMessage, UiItem } from '@/store/session'
import { RevealText } from '../chat/RevealText'
import { Text } from '../chat/Text'
import { GenUiBlock } from '../genui/GenUiBlock'
import { promptOf } from './RecapRow'

type Entry = { seq: number; m: ChatMessage } | { seq: number; u: UiItem }

/**
 * "Show conversation": the earlier turns in compact form, collapsed by default (the chat shell shows
 * one card at a time). Answered cards appear as their question; the answer is the golfer's message.
 */
export function ConversationHistory({ messages, ui }: { messages: ChatMessage[]; ui: UiItem[] }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  if (messages.length === 0 && ui.length === 0) return null

  const entries: Entry[] = [...messages.map((m) => ({ seq: m.seq, m })), ...ui.map((u) => ({ seq: u.seq, u }))].sort(
    (a, b) => a.seq - b.seq,
  )

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex cursor-pointer items-center gap-2 self-start border-0 bg-transparent p-0 font-display text-[13px] font-semibold tracking-[0.16em] text-on-page-3 uppercase transition-ui hover:text-orange-on-page"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={open ? 'rotate-180 transition-ui' : 'transition-ui'}>
          <path d="M6 9l6 6 6-6" />
        </svg>
        {open ? 'Hide conversation' : 'Show conversation'}
      </button>
      {open && (
        <ol id={panelId} aria-label="Conversation so far" className="m-0 flex list-none flex-col gap-3 border-b border-page-line p-0 pb-5">
          {entries.map((e) =>
            'm' in e ? (
              e.m.role === 'user' ? (
                <li key={e.m.id} className="max-w-[78%] self-end rounded-[16px_16px_4px_16px] bg-page-line px-4 py-2.5 text-[15px] leading-normal text-on-page">
                  <span className="sr-only">You: </span>
                  <Text text={e.m.text} />
                </li>
              ) : (
                <li key={e.m.id} className="flex max-w-[88%] items-start gap-3 text-[16px] leading-normal text-on-page-2 [&_strong]:text-on-page">
                  <FitterAvatar size={28} />
                  <p className="m-0 pt-0.5">
                    <span className="sr-only">Fitter: </span>
                    <RevealText text={e.m.text.trim()} animate={false} />
                  </p>
                </li>
              )
            ) : e.u.interactive ? (
              promptOf(e.u) && (
                <li key={e.u.id} className="ml-10 font-display text-[13px] font-semibold tracking-[0.12em] text-on-page-3 uppercase">
                  Card: {promptOf(e.u)}
                </li>
              )
            ) : (
              <li key={e.u.id} className="ml-10 rounded-14 bg-washed-white p-4 text-midnight ring-1 ring-card-edge">
                <GenUiBlock id={e.u.id} block={e.u.block} interactive={false} busy={false} respond={() => {}} />
              </li>
            ),
          )}
        </ol>
      )}
    </div>
  )
}
