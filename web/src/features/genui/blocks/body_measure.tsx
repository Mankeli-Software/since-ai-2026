import { type ReactNode, type Ref, useEffect, useId, useRef, useState } from 'react'
import { Button, EnterKbd, Kbd, ProvenancePill, useArrowKeys, useEnterKey, useNumberKeys } from '@/components/studio'
import { INCHES_TO_CM, convertProseLengths, convertProseUnits } from '@/lib/units'
import { cn } from '@/lib/utils'
import { useUnitsStore } from '@/store/units'
import type { BlockProps } from '../types'
import { Answered, BigNumber, ReadOnly, cardLabelCls, isReadOnly } from './_parts/Answered'
import { HandFigure, HeightFigure, WristFigure } from './_parts/BodyFigures'
import { ArrowKbds, Range, stepValue } from './_parts/Range'
import { Segmented } from './_parts/Segmented'
import { UnitSwitch } from './_parts/UnitSwitch'

export const type = 'body_measure'

type Block = BlockProps<'body_measure'>['block']
type Unit = 'cm' | 'in'
type Respond = BlockProps['respond']

// Pack Glove sizes (fallback when the block sends no `options`). `sub` = hand length, wrist crease to fingertip.
const GLOVES = [
  { id: 'S', label: 'S', sub: '17 cm' },
  { id: 'M', label: 'M', sub: '18 cm' },
  { id: 'M/L', label: 'M/L', sub: '18.5 cm' },
  { id: 'L', label: 'L', sub: '19 cm' },
  { id: 'XL', label: 'XL', sub: '20 cm' },
]

// Short how-to steps per boxed-input field (C6b copy). Longer copy lives in fixtures/diagrams.json.
const STEPS: Partial<Record<Block['field'], string[]>> = {
  wrist_to_floor: ['Shoes on, stand tall', 'Let your arms hang loose', 'Measure wrist crease to floor'],
  hand_length: ['Open your hand flat', 'Find the crease at your wrist', 'Measure to the tip of your middle finger'],
}
const FIELD_LABEL: Record<Block['field'], string> = {
  height: 'Your height',
  wrist_to_floor: 'Wrist to floor',
  hand_length: 'Hand length',
  glove: 'Glove size',
}

// Slider ranges and typical starting values (#216). `typed` = what the typed field accepts, in cm (wider than the
// slider, so a very tall or short golfer can still type an exact value). Defaults are a starting point, not evidence.
const LENGTHS = {
  height: { def: 175, cm: { min: 150, max: 210, step: 1 }, in: { min: 59, max: 83, step: 1 }, typed: [120, 230] },
  wrist_to_floor: { def: 86, cm: { min: 65, max: 105, step: 1 }, in: { min: 26, max: 41, step: 0.5 }, typed: [50, 120] },
  hand_length: { def: 18.5, cm: { min: 15, max: 23, step: 0.5 }, in: { min: 6, max: 9, step: 0.25 }, typed: [12, 26] },
} as const

const round1 = (n: number) => Math.round(n * 10) / 10
const ftIn = (inches: number) => `${Math.floor(inches / 12)}′${Math.round(inches % 12)}″`
const unitLabel = (u: Unit, field: Block['field']) => (u === 'cm' ? 'cm' : field === 'height' ? 'ft / in' : 'in')
const DEFAULTED = ' (default)'

/** "Not sure" for any field: the fitter falls back to a chart or asks something else. */
const unsure = (block: Block, respond: Respond) => respond({ field: block.field, value: null, unsure: true }, 'Not sure')

/** The answered measurement: `value_cm` for the number fields, `value` (size id) for glove. */
interface Answer {
  value_cm?: number
  value?: string | null
  unsure?: boolean
}

/**
 * C6a / C6b / C6: illustration panel + one measurement; Enter = Next. Height, wrist to floor and hand length each have
 * a slider and a typed field that stay in sync, starting at a typical value marked "Default" until the golfer touches
 * it (#216). ← / → change the value or glove size, number keys pick a glove size. Numeric fields resume with
 * `{field, value_cm, unit, raw}` (+ `defaulted: true` when sent untouched); glove resumes with
 * `{field: "glove", value: <size id>, raw: <label>}`; "Not sure" resumes with `{field, value: null, unsure: true}`.
 * In the history (#216 comment 8) the answered card renders read-only with the golfer's value.
 */
export function Component({ block, interactive, answer, busy, respond }: BlockProps<'body_measure'>) {
  if (isReadOnly(interactive, answer) && answer) {
    const a = (answer.value ?? {}) as Answer
    const seedCm = typeof a.value_cm === 'number' ? a.value_cm : undefined
    const seedGlove = typeof a.value === 'string' ? a.value : undefined
    if (a.unsure || (seedCm === undefined && seedGlove === undefined)) return <Answered prompt={block.prompt} answer={answer} />
    return (
      <ReadOnly answer={answer}>
        <Parts block={block} busy={false} respond={respond} ro seedCm={seedCm} seedGlove={seedGlove} />
      </ReadOnly>
    )
  }
  if (!interactive || answer) return <Answered prompt={block.prompt} answer={answer} />
  return <Parts block={block} busy={busy} respond={respond} />
}

interface PartProps {
  block: Block
  busy: boolean
  respond: Respond
  /** Read-only history view: no keys, no typed fields, no footer. */
  ro?: boolean
  seedCm?: number
  seedGlove?: string
}

function Parts(p: PartProps) {
  return (
    <div className="grid grid-cols-2 items-stretch gap-6">
      {p.block.field === 'glove' ? <Glove {...p} /> : p.block.field === 'height' ? <Height {...p} /> : <Boxed {...p} />}
    </div>
  )
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[300px] items-center justify-center rounded-14 bg-grey-ed p-3">{children}</div>
}

/** The dark "Next" with its Enter hint; Enter runs it (the typed fields' own Enter handlers are left alone). */
function NextButton({ busy, onNext, canNext }: { busy: boolean; onNext: () => void; canNext: boolean }) {
  useEnterKey(onNext, !busy && canNext)
  return (
    <Button variant="dark" className="min-h-[52px] pr-3 pl-6" disabled={busy || !canNext} aria-keyshortcuts="Enter" onClick={onNext}>
      Next
      <EnterKbd />
    </Button>
  )
}

function Footer({ block, busy, respond, onNext, canNext }: PartProps & { onNext: () => void; canNext: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Button variant="outline" disabled={busy} onClick={() => unsure(block, respond)}>Not sure</Button>
      <NextButton busy={busy} onNext={onNext} canNext={canNext} />
    </div>
  )
}

function useUnits(block: Block) {
  // The global units store is the source of truth; picking a unit here writes it for all later steps.
  const storeUnits = useUnitsStore((s) => s.units)
  const units: Unit[] = block.unit_options?.length ? block.unit_options : ['cm', 'in']
  const defaultUnit: Unit = storeUnits === 'metric' ? 'cm' : 'in'
  const unit = units.includes(defaultUnit) ? defaultUnit : units[0]
  const setUnit = (u: Unit) => useUnitsStore.getState().setUnits(u === 'cm' ? 'metric' : 'imperial')
  return { units, unit, setUnit }
}

/** "Default" (dashed) until the golfer touches the value. */
function DefaultPill({ show }: { show: boolean }) {
  return show ? <ProvenancePill kind="guess" label="Default" /> : null
}

/**
 * A small typed number box synced with a slider: shows `value` until the golfer types; a valid number in
 * `min`..`max` updates the value at once, Enter runs `onEnter`, leaving the box shows the value again.
 */
function TypedNumber(p: {
  value: number
  min: number
  max: number
  label: string
  suffix: string
  disabled: boolean
  onValue: (n: number) => void
  onEnter: () => void
  inputRef?: Ref<HTMLInputElement>
  id?: string
  className?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const parse = (raw: string) => {
    const n = Number(raw.trim().replace(',', '.'))
    return raw.trim() !== '' && Number.isFinite(n) && n >= p.min && n <= p.max ? n : null
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[15px] text-grey-55">
      <input
        ref={p.inputRef}
        id={p.id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={p.label}
        value={draft ?? String(round1(p.value))}
        disabled={p.disabled}
        onChange={(e) => {
          setDraft(e.target.value)
          const n = parse(e.target.value)
          if (n !== null) p.onValue(n)
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !p.disabled && (draft === null || parse(draft) !== null)) p.onEnter()
        }}
        className={cn(
          'h-11 w-[76px] rounded-10 border border-grey-c8 bg-white px-2 text-center font-display text-[20px] font-bold text-midnight tabular-nums outline-none focus-visible:border-midnight disabled:opacity-60',
          p.className,
        )}
      />
      {p.suffix}
    </span>
  )
}

/** C6a: big number + range 150-210 cm, a typed field (cm, or ft + in), unit switch cm / ft·in. */
function Height({ block, busy, respond, ro, seedCm }: PartProps) {
  const { units, unit, setUnit } = useUnits(block)
  const cfg = LENGTHS.height
  const [cm, setCm] = useState(() => seedCm ?? Math.min(cfg.cm.max, Math.max(cfg.cm.min, Math.round(block.value ?? cfg.def))))
  const [touched, setTouched] = useState(false)
  const id = useId()
  const inches = Math.round(cm / INCHES_TO_CM)
  const set = (v: number) => {
    setCm(v)
    setTouched(true)
  }
  const setInches = (i: number) => {
    if (i >= cfg.typed[0] / INCHES_TO_CM && i <= cfg.typed[1] / INCHES_TO_CM) set(Math.round(i * INCHES_TO_CM))
  }
  useArrowKeys(
    (dir, big) => (unit === 'in' ? setInches(stepValue(inches, dir, big, cfg.in)) : set(stepValue(cm, dir, big, cfg.cm))),
    !busy && !ro,
  )
  const submit = () => {
    const extra = touched ? {} : { defaulted: true }
    const tail = touched ? '' : DEFAULTED
    if (unit === 'in') {
      respond({ field: block.field, value_cm: round1(inches * INCHES_TO_CM), unit, raw: inches, ...extra }, `${Math.floor(inches / 12)} ft ${inches % 12} in${tail}`)
    } else {
      respond({ field: block.field, value_cm: round1(cm), unit, raw: round1(cm), ...extra }, `${round1(cm)} cm${tail}`)
    }
  }

  return (
    <>
      <Panel><HeightFigure cm={cm} /></Panel>
      <div className="flex flex-col justify-center gap-4">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={id} className={cardLabelCls}>{block.prompt || FIELD_LABEL.height}</label>
          {!ro && (
            <span className="flex items-center gap-3">
              <ArrowKbds />
              <DefaultPill show={!touched} />
            </span>
          )}
        </div>
        {unit === 'in' ? <BigNumber value={ftIn(inches)} size={96} /> : <BigNumber value={round1(cm)} unit="cm" size={96} />}
        {unit === 'in' ? (
          <Range
            id={id} min={cfg.in.min} max={cfg.in.max} step={cfg.in.step} value={inches} disabled={busy} aria-keyshortcuts="ArrowLeft ArrowRight" aria-valuetext={ftIn(inches)}
            onChange={(e) => set(Math.round(Number(e.target.value) * INCHES_TO_CM))}
          />
        ) : (
          <Range
            id={id} min={cfg.cm.min} max={cfg.cm.max} step={cfg.cm.step} value={cm} disabled={busy} aria-keyshortcuts="ArrowLeft ArrowRight" aria-valuetext={`${round1(cm)} cm`}
            onChange={(e) => set(Number(e.target.value))}
          />
        )}
        <div className="flex justify-between text-[14px] text-grey-55">
          {unit === 'in' ? <><span>4′11″</span><span>5′11″</span><span>6′11″</span></> : <><span>150</span><span>180</span><span>210 cm</span></>}
        </div>
        {!ro && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2.5 text-[15px] text-grey-55">
              Or type it
              {unit === 'in' ? (
                <>
                  <TypedNumber
                    value={Math.floor(inches / 12)} min={3} max={7} label="Feet" suffix="ft" disabled={busy}
                    onValue={(ft) => setInches(ft * 12 + (inches % 12))} onEnter={submit} className="w-[56px]"
                  />
                  <TypedNumber
                    value={inches % 12} min={0} max={11.99} label="Inches" suffix="in" disabled={busy}
                    onValue={(i) => setInches(Math.floor(inches / 12) * 12 + Math.round(i))} onEnter={submit} className="w-[56px]"
                  />
                </>
              ) : (
                <TypedNumber value={cm} min={cfg.typed[0]} max={cfg.typed[1]} label="Height in cm" suffix="cm" disabled={busy} onValue={set} onEnter={submit} />
              )}
            </span>
            {units.length > 1 && (
              <Segmented
                size="sm" label="Unit" value={unit} onChange={setUnit} disabled={busy}
                options={units.map((u) => ({ id: u, label: unitLabel(u, 'height') }))}
              />
            )}
          </div>
        )}
        {!ro && <Footer block={block} busy={busy} respond={respond} onNext={submit} canNext />}
      </div>
    </>
  )
}

/** C6b: numbered steps + a big typed field and a slider in sync (wrist to floor, hand length). */
function Boxed({ block, busy, respond, ro, seedCm }: PartProps) {
  const { units, unit, setUnit } = useUnits(block)
  const cfg = LENGTHS[block.field === 'hand_length' ? 'hand_length' : 'wrist_to_floor']
  const [cm, setCm] = useState(() => seedCm ?? block.value ?? cfg.def)
  const [touched, setTouched] = useState(false)
  const id = useId()
  const range = unit === 'in' ? cfg.in : cfg.cm
  const shown = round1(unit === 'in' ? cm / INCHES_TO_CM : cm)
  const toCm = (v: number) => (unit === 'in' ? v * INCHES_TO_CM : v)
  const set = (v: number) => {
    setCm(toCm(v))
    setTouched(true)
  }
  // The field is the card's main input, so it takes focus at once with the default selected: digits replace it.
  const fieldRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ro) return
    fieldRef.current?.focus({ preventScroll: true })
    fieldRef.current?.select()
  }, [ro])
  useArrowKeys((dir, big) => set(stepValue(shown, dir, big, range)), !busy && !ro)
  const submit = () =>
    respond(
      { field: block.field, value_cm: round1(cm), unit, raw: shown, ...(touched ? {} : { defaulted: true }) },
      `${shown} ${unit}${touched ? '' : DEFAULTED}`,
    )
  const steps = STEPS[block.field] ?? []
  const mid = Math.round((range.min + range.max) / 2 / range.step) * range.step

  return (
    <>
      <Panel>
        {block.field === 'hand_length' ? <HandFigure label={`${shown} ${unit.toUpperCase()}`} /> : <WristFigure label={`${shown} ${unit.toUpperCase()}`} />}
      </Panel>
      <div className="flex flex-col justify-center gap-4">
        <p className={cn('m-0', cardLabelCls)}>{block.prompt}</p>
        {steps.length > 0 && (
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                <span className="inline-flex size-7 flex-none items-center justify-center rounded-full bg-midnight font-display text-[15px] font-bold text-washed-white tabular-nums">
                  {i + 1}
                </span>
                <span className="text-[16px]">{s}</span>
              </li>
            ))}
          </ol>
        )}
        <div className="flex items-end gap-2.5">
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="flex items-center justify-between gap-3">
              <label htmlFor={id} className="text-[16px] font-semibold">{FIELD_LABEL[block.field]}</label>
              {!ro && <DefaultPill show={!touched} />}
            </span>
            <TypedNumber
              id={id}
              inputRef={fieldRef}
              value={shown}
              min={round1(unit === 'in' ? cfg.typed[0] / INCHES_TO_CM : cfg.typed[0])}
              max={round1(unit === 'in' ? cfg.typed[1] / INCHES_TO_CM : cfg.typed[1])}
              label={`${FIELD_LABEL[block.field]} in ${unit}`}
              suffix=""
              disabled={busy}
              onValue={set}
              onEnter={submit}
              className="h-16 w-full border-2 border-midnight px-4 text-left text-[36px] font-extrabold focus-visible:border-tiger-orange"
            />
          </div>
          {units.length > 1 && !ro ? (
            <Segmented
              size="sm" label="Unit" value={unit} onChange={setUnit} disabled={busy} className="mb-2"
              options={units.map((u) => ({ id: u, label: unitLabel(u, block.field) }))}
            />
          ) : (
            <span className="pb-[18px] text-[18px] text-grey-55">{unit}</span>
          )}
        </div>
        <Range
          min={range.min} max={range.max} step={range.step} value={shown} disabled={busy}
          aria-label={`${FIELD_LABEL[block.field]} slider`} aria-keyshortcuts="ArrowLeft ArrowRight" aria-valuetext={`${shown} ${unit}`}
          onChange={(e) => set(Number(e.target.value))}
        />
        <div className="flex justify-between text-[14px] text-grey-55">
          <span>{range.min}</span>
          <span>{mid}</span>
          <span>{range.max} {unit}</span>
        </div>
        {block.field === 'wrist_to_floor' && !ro && (
          <span className="flex items-center gap-2 text-[15px]">
            <button type="button" disabled className="cursor-not-allowed border-0 bg-transparent p-0 font-semibold text-orange-text underline opacity-60">
              Measure with my camera instead
            </button>
            <span className="text-[13px] text-grey-6b">coming soon</span>
          </span>
        )}
        {!ro && <Footer block={block} busy={busy} respond={respond} onNext={submit} canNext />}
      </div>
    </>
  )
}

/** C6: size tiles (from `options`, else the 5 pack sizes) + dashed "Don't know?" helper + cm / in switch. */
function Glove({ block, busy, respond, ro, seedGlove }: PartProps) {
  const storeUnits = useUnitsStore((s) => s.units)
  const prose = (t: string) => convertProseLengths(convertProseUnits(t, storeUnits), storeUnits)
  const opts: { id: string; label: string; sub?: string | null }[] = block.options?.length ? block.options : GLOVES
  const groupId = useId()
  const [picked, setPicked] = useState<string | null>(
    () => opts.find((o) => o.id === (seedGlove ?? String(block.value ?? '')))?.id ?? null,
  )
  const chosen = opts.find((o) => o.id === picked)
  const keys = !busy && !ro
  useNumberKeys(opts.length, (i) => setPicked(opts[i]?.id ?? null), keys)
  // Sizes run small to large, so ← / → step through them (from nothing picked, → starts at the smallest, ← at the largest).
  useArrowKeys((dir) => {
    const i = opts.findIndex((o) => o.id === picked)
    const next = i < 0 ? (dir > 0 ? 0 : opts.length - 1) : Math.min(opts.length - 1, Math.max(0, i + dir))
    setPicked(opts[next]?.id ?? null)
  }, keys)
  const submit = () => chosen && respond({ field: 'glove', value: chosen.id, raw: chosen.label }, `Glove ${chosen.label}`)

  return (
    <>
      <Panel><HandFigure label={chosen?.sub ? prose(chosen.sub).toUpperCase() : undefined} /></Panel>
      <div className="flex flex-col justify-center gap-4">
        <span className="flex items-center justify-between gap-3">
          <span id={groupId} className={cardLabelCls}>{block.prompt || FIELD_LABEL.glove}</span>
          {!ro && <UnitSwitch labels={{ metric: 'cm', imperial: 'in' }} disabled={busy} />}
        </span>
        <div role="group" aria-labelledby={groupId} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(opts.length, 5)}, minmax(0, 1fr))` }}>
          {opts.map((o, i) => {
            const on = o.id === picked
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={on}
                aria-keyshortcuts={i < 9 ? String(i + 1) : undefined}
                disabled={busy && !ro}
                onClick={() => setPicked(o.id)}
                className={cn(
                  'relative flex h-[72px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-12 border bg-white text-midnight transition-ui disabled:cursor-not-allowed disabled:opacity-60',
                  on ? 'border-midnight shadow-[inset_0_0_0_1px_#0B0B0B]' : 'border-grey-d9 hover:border-grey-8f',
                )}
              >
                <span className="font-display text-[28px] leading-none font-extrabold">{o.label}</span>
                {o.sub && <span className="text-[12px] text-grey-55">{prose(o.sub)}</span>}
                {i < 9 && !ro && <Kbd className="absolute top-1 right-1 h-[18px] min-w-[18px] px-1 text-[11px]">{i + 1}</Kbd>}
              </button>
            )
          })}
        </div>
        {!ro && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => unsure(block, respond)}
              className="flex min-h-12 cursor-pointer items-center gap-2.5 rounded-12 border border-dashed border-grey-8f bg-transparent px-4 py-2 text-left font-sans text-[15px] font-medium text-grey-33 transition-ui hover:border-midnight disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>
                <b className="font-semibold text-midnight">Don't know?</b> Measure wrist crease to middle fingertip and match the {storeUnits === 'metric' ? 'cm' : 'inches'}, or tap here to skip.
              </span>
            </button>
            <div className="flex items-center justify-end gap-3 border-t border-grey-e4 pt-2">
              <NextButton busy={busy} onNext={() => void submit()} canNext={!!chosen} />
            </div>
          </>
        )}
      </div>
    </>
  )
}
