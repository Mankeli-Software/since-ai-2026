import { useId, useState } from 'react'
import { Button, EnterKbd, Kbd, OptTile, useEnterKey, useNumberKeys } from '@/components/studio'
import { cn } from '@/lib/utils'
import type { BlockProps } from '../types'
import { Answered, ReadOnly, cardLabelCls } from './_parts/Answered'

export const type = 'choice_chips'

// C2: `.opt` grid, 2-4 columns by count (5-6 options wrap as 3 + 3).
const COLS: Record<number, string> = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }

// #216: a picture per option, one SVG per file at `visuals/<field>/<option id, spaces as dashes>.svg`. Collected here,
// so adding a picture is a file drop; options without one keep the text-only tile.
const VISUALS: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('../visuals/*/*.svg', { eager: true, query: '?url', import: 'default' })).map(
    ([path, url]) => [path.replace(/^\.\.\/visuals\/|\.svg$/g, ''), url],
  ),
)
const visualOf = (field: string | null | undefined, id: string) => (field ? VISUALS[`${field}/${id.replace(/\s+/g, '-')}`] : undefined)

/** The option ids an answer picked: an id, an id list (multi), or nothing for "Not sure" and free text. */
const pickedOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : typeof value === 'string' ? [value] : []

/**
 * Reference block: copy this shape for every new block.
 * Single pick resumes with the option id (or number key); `multi` resumes with an id list after "That's it" (Enter).
 * "Not sure" resumes with null (same as slider's unknown); free text resumes with the typed string.
 */
export function Component({ block, interactive, answer, busy, respond }: BlockProps<'choice_chips'>) {
  const [picked, setPicked] = useState<string[]>([])
  const [text, setText] = useState('')
  const freeId = useId()
  const live = interactive && !busy && !answer
  const opts = block.options

  const pick = (i: number) => {
    const o = opts[i]
    if (!o) return
    if (!block.multi) return respond(o.id, o.label)
    setPicked((p) => {
      if (o.id === 'none') return p.includes('none') ? [] : ['none'] // "none" is exclusive
      const clean = p.filter((x) => x !== 'none')
      if (clean.includes(o.id)) return clean.filter((x) => x !== o.id)
      if (block.field === 'characteristics' && clean.length >= 3) return clean // the pack counts only the top 3
      return [...clean, o.id]
    })
  }
  useNumberKeys(opts.length, pick, live)

  const canSendMulti = picked.length > 0 || block.field === 'joint_pain'
  const sendMulti = () => {
    const ids = picked.length === 0 && block.field === 'joint_pain' ? ['none'] : picked
    const labels = ids.map((id) => opts.find((o) => o.id === id)?.label ?? id).join(', ')
    respond(ids, labels || 'None')
  }
  useEnterKey(sendMulti, live && !!block.multi && canSendMulti)

  const pictured = opts.some((o) => visualOf(block.field, o.id))
  const tiles = (selected: string[], readOnly = false) => (
    <div className={cn('grid gap-3', COLS[opts.length] ?? 'grid-cols-3')}>
      {opts.map((o, i) => {
        const kbd = !readOnly && i < 9 ? i + 1 : undefined
        const src = visualOf(block.field, o.id)
        return (
          <OptTile
            key={o.id}
            kbd={pictured ? undefined : kbd}
            selected={selected.includes(o.id)}
            disabled={!readOnly && busy}
            title={o.hint ?? undefined}
            onClick={() => pick(i)}
            className={pictured ? 'relative flex-col items-stretch gap-0 px-3 pt-3 pb-3.5' : undefined}
          >
            {pictured && (
              <span className="mb-2.5 flex h-[72px] items-center justify-center rounded-10 bg-grey-ed">
                {src && <img src={src} alt="" draggable={false} className="h-full w-auto max-w-full py-1.5" />}
              </span>
            )}
            <span className="block">{o.label}</span>
            {o.hint && <span className="block text-[14px] font-normal leading-snug text-grey-55">{o.hint}</span>}
            {pictured && kbd !== undefined && <Kbd className="absolute top-4 right-4 bg-white">{kbd}</Kbd>}
          </OptTile>
        )
      })}
    </div>
  )

  // #216 comment 8: in the history, the real tiles with the golfer's pick selected.
  if (!interactive && answer) {
    return (
      <ReadOnly answer={answer}>
        <p className={cn('m-0', cardLabelCls)}>{block.prompt}</p>
        {tiles(pickedOf(answer.value), true)}
      </ReadOnly>
    )
  }
  if (!interactive || answer) return <Answered prompt={block.prompt} answer={answer} />

  const sendText = () => {
    const t = text.trim()
    if (t) respond(t, t)
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <p className={cn('m-0', cardLabelCls)}>{block.prompt}</p>
      {block.multi && <span className="-mt-2.5 text-[16px] text-grey-33">Pick all that fit.</span>}
      {tiles(picked)}

      {block.allow_free_text && (
        <form
          className="flex h-12 items-center gap-2 rounded-full border border-grey-c8 bg-white pr-1.5 pl-5"
          onSubmit={(e) => {
            e.preventDefault()
            sendText()
          }}
        >
          <label htmlFor={freeId} className="sr-only">Or type your answer</label>
          <input
            id={freeId}
            type="text"
            value={text}
            disabled={busy}
            maxLength={200}
            placeholder="Or type it in your own words…"
            onChange={(e) => setText(e.target.value)}
            className="h-full min-w-0 flex-1 border-0 bg-transparent font-sans text-[17px] text-midnight outline-none placeholder:text-grey-6b"
          />
          <Button type="submit" variant="dark" size="sm" disabled={busy || !text.trim()} className="min-h-9">Send</Button>
        </form>
      )}

      <div className="flex items-center gap-3">
        <Button variant="outline" disabled={busy} onClick={() => respond(null, 'Not sure')}>Not sure</Button>
        {block.multi && (
          <Button variant="dark" className="ml-auto pr-3" disabled={busy || !canSendMulti} aria-keyshortcuts="Enter" onClick={sendMulti}>
            {picked.length === 0 ? 'None' : "That's it"}
            <EnterKbd />
          </Button>
        )}
      </div>
    </div>
  )
}
