import { useState } from 'react'
import { Button, EnterKbd, Eyebrow, useEnterKey } from '@/components/studio'
import type { BlockOf, BlockProps } from '../types'

export const type = 'heard_summary'

type Fact = BlockOf<'heard_summary'>['facts'][number]

const LEAD = 'One thing would sharpen it:'

/** "wrist_to_floor_cm" + "cm" -> "Wrist to floor in cm". */
function fieldLabel(field: string, unit: string) {
  const words = field.replace(/_(cm|mm|in|m|kg|mph)$/, '').replace(/_/g, ' ')
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} in ${unit}`
}

/** The prompt without the bold lead, if the model already wrote it. */
const promptRest = (prompt: string) =>
  prompt.toLowerCase().startsWith(LEAD.toLowerCase()) ? prompt.slice(LEAD.length).trim() : prompt

function CheckCircle() {
  return (
    <span aria-hidden="true" className="inline-flex size-[18px] flex-none items-center justify-center rounded-full bg-midnight">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#F8F8F8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12l5 5 9-10" />
      </svg>
    </span>
  )
}

function FactChips({ facts }: { facts: Fact[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
      {facts.map((f, i) => (
        <li
          key={`${i}-${f.label}`}
          className="inline-flex h-[42px] items-center gap-2 rounded-full border border-grey-d9 bg-white px-4 text-[16px] font-semibold text-midnight"
        >
          {f.source === 'measured' ? (
            <span aria-hidden="true" className="size-2 flex-none rounded-full bg-tiger-orange" />
          ) : (
            <CheckCircle />
          )}
          <span className="sr-only">{f.source === 'measured' ? 'Measured: ' : 'You said: '}</span>
          {f.label}
        </li>
      ))}
    </ul>
  )
}

/** C2b: confirm everything read from one long message; ask only for the missing field. */
export function Component({ block, interactive, answer, busy, respond }: BlockProps<'heard_summary'>) {
  const [raw, setRaw] = useState('')
  const live = interactive && !answer
  const { missing } = block

  const send = () => {
    if (busy) return
    const n = Number(raw.trim().replace(',', '.'))
    const missing_value = raw.trim() !== '' && Number.isFinite(n) ? n : undefined
    respond({ missing_value }, 'Show my fit')
  }
  // Enter in the number field submits the form natively; this covers Enter anywhere else.
  useEnterKey(send, live && !busy)

  if (!live) {
    const v = (answer?.value as { missing_value?: number } | undefined)?.missing_value
    return (
      <div className="flex flex-col gap-3">
        <Eyebrow className="text-grey-55">Here's what I heard</Eyebrow>
        <FactChips facts={block.facts} />
        {missing && v !== undefined && (
          <p className="m-0 text-[15px] text-grey-55">
            {fieldLabel(missing.field, missing.unit).replace(/ in \S+$/, '')}:{' '}
            <strong className="font-semibold text-midnight">
              {v} {missing.unit}
            </strong>
          </p>
        )}
      </div>
    )
  }

  const skipped = block.skipped_count
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        send()
      }}
      className="flex flex-col gap-[18px]"
    >
      <Eyebrow className="text-grey-55">Here's what I heard</Eyebrow>
      <FactChips facts={block.facts} />
      {missing && (
        <div className="flex items-center gap-4 rounded-12 bg-orange-tint px-4 py-3.5 text-midnight">
          <span className="flex-1 text-[16px]">
            <b>{LEAD}</b> {promptRest(missing.prompt)}
          </span>
          <input
            type="text"
            inputMode="decimal"
            aria-label={fieldLabel(missing.field, missing.unit)}
            placeholder={missing.unit}
            value={raw}
            disabled={busy}
            onChange={(e) => setRaw(e.target.value)}
            className="h-11 w-[90px] rounded-8 border border-grey-c8 bg-white px-3 font-display text-[20px] font-bold tabular-nums text-midnight placeholder:text-grey-8f disabled:opacity-50"
          />
        </div>
      )}
      <div className="flex items-center justify-between gap-4 border-t border-grey-e4 pt-1.5">
        <span className="text-[15px] text-grey-55">
          {skipped > 0 && `I skipped ${skipped} ${skipped === 1 ? 'question' : 'questions'} you already answered.`}
        </span>
        <Button type="submit" size="xl" disabled={busy} aria-keyshortcuts="Enter" className="min-h-[58px] pr-4 pl-7 text-[22px]">
          Show my fit →
          <EnterKbd tone="primary" />
        </Button>
      </div>
    </form>
  )
}
