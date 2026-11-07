import { Fragment, useId, useState } from 'react'
import { Button, OptTile, useNumberKeys } from '@/components/studio'
import { cn } from '@/lib/utils'
import type { BlockOf, BlockProps } from '../types'

export const type = 'sentence_builder'

type Token = BlockOf<'sentence_builder'>['tokens'][number]
type Values = Record<string, string | undefined>
/** Template split into literal text (string) and token slots. */
type Part = string | Token

function parseTemplate(template: string, tokens: Token[]): Part[] {
  const byId = new Map(tokens.map((t) => [t.id, t]))
  return template.split(/\{(\w+)\}/g).map((s, i) => (i % 2 ? (byId.get(s) ?? `{${s}}`) : s))
}

const optionLabel = (t: Token, v: string | undefined) => t.options.find((o) => o.id === v)?.label

/** A token's `value` is prefilled when it names one of its options. */
function initialValues(tokens: Token[]): Values {
  return Object.fromEntries(tokens.map((t) => [t.id, optionLabel(t, t.value ?? undefined) ? (t.value ?? undefined) : undefined]))
}

/** The completed sentence in plain words (unfilled tokens fall back to their placeholder). */
function sentenceText(parts: Part[], values: Values) {
  return parts
    .map((p) => (typeof p === 'string' ? p : (optionLabel(p, values[p.id]) ?? p.placeholder)))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Next unfilled token after `from` (wrapping), or null when all are filled. */
function nextUnfilled(tokens: Token[], values: Values, from = -1): string | null {
  for (let k = 1; k <= tokens.length; k++) {
    const t = tokens[(from + k + tokens.length) % tokens.length]
    if (!values[t.id]) return t.id
  }
  return null
}

const pillBase =
  'mx-0.5 inline-flex h-[52px] cursor-pointer items-center gap-2 rounded-full px-[22px] align-middle font-sans text-[32px] font-medium transition-ui disabled:cursor-not-allowed'

/** C2 mad-lib: tap a word pill, pick from the option grid; auto-advances; "That's me" sends `{token_id: option_id}`. */
export function Component({ block, interactive, answer, busy, respond }: BlockProps<'sentence_builder'>) {
  const { tokens } = block
  const parts = parseTemplate(block.template, tokens)
  const [values, setValues] = useState<Values>(() => initialValues(tokens))
  const [active, setActive] = useState<string | null>(() => nextUnfilled(tokens, initialValues(tokens)))
  const gridId = useId()

  const live = interactive && !answer
  const activeToken = tokens.find((t) => t.id === active) ?? null
  const options = activeToken?.options ?? []
  const allFilled = tokens.every((t) => values[t.id])

  const pick = (optionId: string) => {
    if (!activeToken) return
    const next = { ...values, [activeToken.id]: optionId }
    setValues(next)
    setActive(nextUnfilled(tokens, next, tokens.indexOf(activeToken)))
  }

  useNumberKeys(options.length, (i) => pick(options[i].id), live && !busy && activeToken !== null)

  if (!live) {
    const shown: Values =
      answer && typeof answer.value === 'object' && answer.value !== null ? (answer.value as Values) : values
    return (
      <p className="m-0 text-[20px] leading-[1.5] text-grey-55">
        {parts.map((p, i) =>
          typeof p === 'string' ? (
            <Fragment key={i}>{p}</Fragment>
          ) : (
            <strong key={i} className="font-semibold text-midnight">
              {optionLabel(p, shown[p.id]) ?? p.placeholder}
            </strong>
          ),
        )}
      </p>
    )
  }

  const submit = () => {
    const value = Object.fromEntries(tokens.map((t) => [t.id, values[t.id] as string]))
    respond(value, sentenceText(parts, values))
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <span className="text-[16px] text-grey-33">{block.prompt}</span>
      <p className="m-0 text-[34px] leading-[1.7] font-medium text-midnight">
        {parts.map((p, i) => {
          if (typeof p === 'string') return <Fragment key={i}>{p}</Fragment>
          const label = optionLabel(p, values[p.id])
          const isActive = p.id === active
          return (
            <button
              key={i}
              type="button"
              disabled={busy}
              aria-expanded={isActive}
              aria-controls={isActive ? gridId : undefined}
              aria-label={`${p.placeholder}: ${label ?? 'not set'}`}
              onClick={() => setActive(isActive && label ? null : p.id)}
              className={cn(
                pillBase,
                isActive
                  ? 'bg-midnight text-washed-white'
                  : label
                    ? 'bg-white text-midnight shadow-[inset_0_0_0_1px_#D9D9D9] hover:shadow-[inset_0_0_0_1px_#8F8F8F]'
                    : 'bg-grey-ed text-grey-8f hover:text-grey-55',
              )}
            >
              {label ?? p.placeholder}
              <span aria-hidden="true">▾</span>
            </button>
          )
        })}
      </p>

      {activeToken && (
        <div
          id={gridId}
          role="group"
          aria-label={`Choose ${activeToken.placeholder}`}
          className="grid grid-cols-4 gap-3"
        >
          {options.map((o, i) => (
            <OptTile
              key={o.id}
              kbd={i < 9 ? i + 1 : undefined}
              aria-keyshortcuts={i < 9 ? String(i + 1) : undefined}
              selected={values[activeToken.id] === o.id}
              disabled={busy}
              onClick={() => pick(o.id)}
            >
              {o.label}
            </OptTile>
          ))}
        </div>
      )}

      {allFilled && (
        <div className="flex justify-end">
          <Button variant="dark" disabled={busy} onClick={submit}>
            That's me
          </Button>
        </div>
      )}
    </div>
  )
}
