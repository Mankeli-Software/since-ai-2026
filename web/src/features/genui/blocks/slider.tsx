import { useId, useState } from 'react'
import { Button, EnterKbd, ProvenancePill, useArrowKeys, useEnterKey } from '@/components/studio'
import { YARDS_TO_METERS } from '@/lib/units'
import { useUnitsStore } from '@/store/units'
import type { BlockProps } from '../types'
import { Answered, BigNumber, ReadOnly, cardLabelCls, isReadOnly } from './_parts/Answered'
import { ArrowKbds, Range, stepValue } from './_parts/Range'
import { Segmented } from './_parts/Segmented'
import { UnitSwitch } from './_parts/UnitSwitch'

export const type = 'slider'

type Block = BlockProps<'slider'>['block']

const fmt = (n: number) => String(Math.round(n * 100) / 100)
const round1 = (n: number) => Math.round(n * 10) / 10
// A typical 7-iron carry when the card sends no value: a starting point to adjust, never evidence.
const DEFAULT_CARRY = { yd: 150, m: 137 }

/** The value the card starts at, in the block's own unit. */
function startValue(block: Block) {
  if (block.value != null) return block.value
  if (block.unit === 'yd' || block.unit === 'm') return Math.min(block.max, Math.max(block.min, DEFAULT_CARRY[block.unit]))
  return Math.round((block.min + block.max) / 2 / block.step) * block.step
}

/** The answered value in the block's own unit (`value`, or `{value, measured}` with the toggle). */
function answeredValue(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && typeof (value as { value?: unknown }).value === 'number') return (value as { value: number }).value
  return null
}

/**
 * Distance sliders (yd / m) show in the golfer's unit choice and convert back to the block's own unit on send, so
 * the number keeps its meaning (invariant 14). Other units (age in years) show as they are.
 */
function useShownScale(block: Block) {
  const units = useUnitsStore((s) => s.units)
  const own = block.unit === 'yd' || block.unit === 'm' ? block.unit : null
  const shown = own ? (units === 'metric' ? 'm' : 'yd') : block.unit
  const converted = own !== null && shown !== own
  const toShown = (v: number) => (!converted ? v : own === 'yd' ? v * YARDS_TO_METERS : v / YARDS_TO_METERS)
  const toOwn = (v: number) => (!converted ? v : own === 'yd' ? v / YARDS_TO_METERS : v * YARDS_TO_METERS)
  // Converted ranges stay inside the block's own bounds, in whole units.
  const min = converted ? Math.ceil(toShown(block.min)) : block.min
  const max = converted ? Math.floor(toShown(block.max)) : block.max
  const step = converted ? 1 : block.step
  const display = (ownValue: number) => (converted ? Math.round(toShown(ownValue)) : ownValue)
  return { own, shown, converted, toOwn, min, max, step, display }
}

/**
 * C3b `slider_guess`: label + provenance pill, big number, range, typed field, scale, guess/measured toggle,
 * Not sure / That's it (Enter). ← / → move the slider from anywhere on the page (Shift = 10 steps). Distance sliders
 * get the shared metric / imperial switch (#216). Until the golfer moves it, types a number or picks guess / measured,
 * the start value is marked "Default" and "That's it" stays off: a typical value is never sent as the golfer's answer
 * (#216 comment 3, plan §3.3). Payload: `value` (block's own unit), or `{value, measured}` with the toggle; unknown = null.
 */
export function Component({ block, interactive, answer, busy, respond }: BlockProps<'slider'>) {
  const scale = useShownScale(block)
  const [value, setValue] = useState(() => startValue(block))
  const [touched, setTouched] = useState(false)
  const [measured, setMeasured] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const inputId = useId()
  const typedId = useId()
  const live = interactive && !answer && !busy

  const shownValue = scale.display(value)
  const setShown = (v: number) => {
    setValue(scale.toOwn(v))
    setTouched(true)
  }
  const send = () => {
    if (!touched) return // the start value is a typical one, not the golfer's
    const out = scale.converted ? round1(value) : value
    const text = `${fmt(shownValue)} ${scale.shown}`
    if (block.measured_or_guessed_toggle) respond({ value: out, measured }, `${text} (${measured ? 'measured' : 'guess'})`)
    else respond(out, text)
  }
  useEnterKey(send, live && touched)
  useArrowKeys((dir, big) => setShown(stepValue(shownValue, dir, big, scale)), live)

  if (isReadOnly(interactive, answer) && answer) {
    const v = answeredValue(answer.value)
    if (v === null) return <Answered prompt={block.prompt} answer={answer} />
    return (
      <ReadOnly answer={answer}>
        <span className={cardLabelCls}>{block.prompt}</span>
        <BigNumber value={fmt(scale.display(v))} unit={scale.shown} />
        <Range min={scale.min} max={scale.max} step={scale.step} value={scale.display(v)} disabled readOnly aria-label={block.prompt} />
      </ReadOnly>
    )
  }
  if (!interactive || answer) return <Answered prompt={block.prompt} answer={answer} />

  const mid = Math.round((scale.min + scale.max) / 2 / scale.step) * scale.step
  const typedNum = (raw: string) => {
    const n = Number(raw.trim().replace(',', '.'))
    return raw.trim() !== '' && Number.isFinite(n) && n >= scale.min && n <= scale.max ? n : null
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={inputId} className={cardLabelCls}>{block.prompt}</label>
        <span className="flex items-center gap-3">
          <ArrowKbds />
          {!touched ? (
            <ProvenancePill kind="guess" label="Default" />
          ) : (
            block.measured_or_guessed_toggle && <ProvenancePill kind={measured ? 'measured' : 'guess'} />
          )}
          {scale.own && <UnitSwitch labels={{ metric: 'm', imperial: 'yd' }} disabled={busy} />}
        </span>
      </div>
      <div className="flex items-end justify-between gap-4">
        <BigNumber value={fmt(shownValue)} unit={scale.shown} />
        <label htmlFor={typedId} className="flex items-center gap-2 pb-2 text-[15px] text-grey-55">
          Or type it
          <input
            id={typedId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={draft ?? fmt(shownValue)}
            disabled={busy}
            onChange={(e) => {
              setDraft(e.target.value)
              const n = typedNum(e.target.value)
              if (n !== null) setShown(n)
            }}
            onBlur={() => setDraft(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !busy && (draft === null || typedNum(draft) !== null)) send()
            }}
            className="h-11 w-[88px] rounded-10 border border-grey-c8 bg-white px-2 text-center font-display text-[20px] font-bold text-midnight tabular-nums outline-none focus-visible:border-midnight disabled:opacity-60"
          />
          {scale.shown}
        </label>
      </div>
      <Range
        id={inputId}
        min={scale.min}
        max={scale.max}
        step={scale.step}
        value={shownValue}
        disabled={busy}
        aria-keyshortcuts="ArrowLeft ArrowRight"
        aria-valuetext={`${fmt(shownValue)} ${scale.shown}`}
        onChange={(e) => {
          setDraft(null)
          setShown(Number(e.target.value))
        }}
      />
      <div className="flex justify-between text-[14px] text-grey-55">
        <span>{fmt(scale.min)} {scale.shown}</span>
        <span>{fmt(mid)}</span>
        <span>{fmt(scale.max)} {scale.shown}</span>
      </div>
      <div className="flex items-center gap-3">
        {block.measured_or_guessed_toggle ? (
          <Segmented
            label="Where this number came from"
            options={[{ id: 'guess', label: "It's a guess" }, { id: 'measured', label: 'I measured it' }]}
            value={measured ? 'measured' : 'guess'}
            onChange={(v) => {
              setMeasured(v === 'measured')
              setTouched(true) // picking guess or measured confirms the number on screen as theirs
            }}
            disabled={busy}
          />
        ) : (
          <span className="flex-1" />
        )}
        {block.allow_unknown && (
          <Button variant="outline" disabled={busy} onClick={() => respond(null, 'Not sure')}>Not sure</Button>
        )}
        {!touched && <span className="text-[14px] text-grey-55">Set your number first</span>}
        <Button variant="dark" disabled={busy || !touched} aria-keyshortcuts="Enter" onClick={send} className="pr-3">
          That's it
          <EnterKbd />
        </Button>
      </div>
    </div>
  )
}
