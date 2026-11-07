import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { Button, EnterKbd, Kbd, useArrowKeys, useEnterKey, useNumberKeys } from '@/components/studio'
import { convertProseUnits } from '@/lib/units'
import { cn } from '@/lib/utils'
import { useUnitsStore } from '@/store/units'
import type { BlockProps } from '../types'
import { Answered, BigNumber, cardLabelCls } from './_parts/Answered'
import { HandFigure, HeightFigure, WristFigure } from './_parts/BodyFigures'
import { ArrowKbds, Range, stepValue } from './_parts/Range'
import { Segmented } from './_parts/Segmented'

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

const round1 = (n: number) => Math.round(n * 10) / 10
const ftIn = (inches: number) => `${Math.floor(inches / 12)}′${Math.round(inches % 12)}″`
const unitLabel = (u: Unit, field: Block['field']) => (u === 'cm' ? 'cm' : field === 'height' ? 'ft / in' : 'in')

/** "Not sure" for any field: the fitter falls back to a chart or asks something else. */
const unsure = (block: Block, respond: Respond) => respond({ field: block.field, value: null, unsure: true }, 'Not sure')

/**
 * C6a / C6b / C6: illustration panel + one measurement; Enter = Next. ← / → change the height or glove size, number keys
 * pick a glove size, and the typed fields take focus so digits go straight in. Numeric fields resume with
 * `{field, value_cm, unit, raw}`; glove resumes with `{field: "glove", value: <size id>, raw: <label>}`;
 * "Not sure" resumes with `{field, value: null, unsure: true}`.
 */
export function Component({ block, interactive, answer, busy, respond }: BlockProps<'body_measure'>) {
  if (!interactive || answer) return <Answered prompt={block.prompt} answer={answer} />
  return (
    <div className="grid grid-cols-2 items-stretch gap-6">
      {block.field === 'glove' ? (
        <Glove block={block} busy={busy} respond={respond} />
      ) : block.field === 'height' ? (
        <Height block={block} busy={busy} respond={respond} />
      ) : (
        <Boxed block={block} busy={busy} respond={respond} />
      )}
    </div>
  )
}

interface PartProps {
  block: Block
  busy: boolean
  respond: Respond
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[300px] items-center justify-center rounded-14 bg-grey-ed p-3">{children}</div>
}

/** The dark "Next" with its Enter hint; Enter runs it (the boxed field's own Enter handler is left alone). */
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

/** C6a: big number + range 150-210 cm, unit switch cm / ft·in. */
function Height({ block, busy, respond }: PartProps) {
  const { units, unit, setUnit } = useUnits(block)
  const [cm, setCm] = useState(() => Math.min(210, Math.max(150, Math.round(block.value ?? 175))))
  const id = useId()
  const inches = Math.round(cm / 2.54)
  useArrowKeys(
    (dir, big) =>
      unit === 'in'
        ? setCm(Math.round(stepValue(inches, dir, big, { min: 59, max: 83, step: 1 }) * 2.54))
        : setCm(stepValue(cm, dir, big, { min: 150, max: 210, step: 1 })),
    !busy,
  )
  const submit = () =>
    unit === 'in'
      ? respond({ field: block.field, value_cm: round1(inches * 2.54), unit, raw: inches }, `${Math.floor(inches / 12)} ft ${inches % 12} in`)
      : respond({ field: block.field, value_cm: cm, unit, raw: cm }, `${cm} cm`)

  return (
    <>
      <Panel><HeightFigure cm={cm} /></Panel>
      <div className="flex flex-col justify-center gap-4">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={id} className={cardLabelCls}>{block.prompt || FIELD_LABEL.height}</label>
          <ArrowKbds />
        </div>
        {unit === 'in' ? <BigNumber value={ftIn(inches)} size={96} /> : <BigNumber value={cm} unit="cm" size={96} />}
        {unit === 'in' ? (
          <Range
            id={id} min={59} max={83} step={1} value={inches} disabled={busy} aria-keyshortcuts="ArrowLeft ArrowRight" aria-valuetext={ftIn(inches)}
            onChange={(e) => setCm(Math.round(Number(e.target.value) * 2.54))}
          />
        ) : (
          <Range
            id={id} min={150} max={210} step={1} value={cm} disabled={busy} aria-keyshortcuts="ArrowLeft ArrowRight" aria-valuetext={`${cm} cm`}
            onChange={(e) => setCm(Number(e.target.value))}
          />
        )}
        <div className="flex justify-between text-[14px] text-grey-55">
          {unit === 'in' ? <><span>4′11″</span><span>5′11″</span><span>6′11″</span></> : <><span>150</span><span>180</span><span>210 cm</span></>}
        </div>
        {units.length > 1 && (
          <Segmented
            size="sm" label="Unit" value={unit} onChange={setUnit} disabled={busy}
            options={units.map((u) => ({ id: u, label: unitLabel(u, 'height') }))}
          />
        )}
        <Footer block={block} busy={busy} respond={respond} onNext={submit} canNext />
      </div>
    </>
  )
}

/** C6b: numbered steps + boxed input (wrist to floor, hand length). */
function Boxed({ block, busy, respond }: PartProps) {
  const { units, unit, setUnit } = useUnits(block)
  const [raw, setRaw] = useState(block.value == null ? '' : String(block.value))
  const id = useId()
  // The field is the whole card, so it takes focus at once: digits type straight in, Enter runs Next.
  const fieldRef = useRef<HTMLInputElement>(null)
  useEffect(() => fieldRef.current?.focus({ preventScroll: true }), [])
  const n = Number(raw.replace(',', '.'))
  const ok = raw.trim() !== '' && Number.isFinite(n) && n > 0
  const submit = () => {
    const cm = unit === 'in' ? n * 2.54 : n
    respond({ field: block.field, value_cm: round1(cm), unit, raw: n }, `${n} ${unit}`)
  }
  const label = ok ? `${n} ${unit.toUpperCase()}` : undefined
  const steps = STEPS[block.field] ?? []

  return (
    <>
      <Panel>{block.field === 'hand_length' ? <HandFigure label={label} /> : <WristFigure label={label} />}</Panel>
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
            <label htmlFor={id} className="text-[16px] font-semibold">{FIELD_LABEL[block.field]}</label>
            <input
              ref={fieldRef}
              id={id}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={raw}
              disabled={busy}
              onChange={(e) => setRaw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && ok && !busy) submit()
              }}
              className="h-16 w-full rounded-10 border-2 border-midnight bg-white px-4 font-display text-[36px] font-extrabold text-midnight tabular-nums outline-none focus-visible:border-tiger-orange disabled:opacity-60"
            />
          </div>
          {units.length > 1 ? (
            <Segmented
              size="sm" label="Unit" value={unit} onChange={setUnit} disabled={busy} className="mb-2"
              options={units.map((u) => ({ id: u, label: unitLabel(u, block.field) }))}
            />
          ) : (
            <span className="pb-[18px] text-[18px] text-grey-55">{unit}</span>
          )}
        </div>
        {block.field === 'wrist_to_floor' && (
          <span className="flex items-center gap-2 text-[15px]">
            <button type="button" disabled className="cursor-not-allowed border-0 bg-transparent p-0 font-semibold text-orange-text underline opacity-60">
              Measure with my camera instead
            </button>
            <span className="text-[13px] text-grey-6b">coming soon</span>
          </span>
        )}
        <Footer block={block} busy={busy} respond={respond} onNext={submit} canNext={ok} />
      </div>
    </>
  )
}

/** C6: size tiles (from `options`, else the 5 pack sizes) + dashed "Don't know?" helper. */
function Glove({ block, busy, respond }: PartProps) {
  const storeUnits = useUnitsStore((s) => s.units)
  const opts: { id: string; label: string; sub?: string | null }[] = block.options?.length ? block.options : GLOVES
  const groupId = useId()
  const [picked, setPicked] = useState<string | null>(() => opts.find((o) => o.id === String(block.value ?? ''))?.id ?? null)
  const chosen = opts.find((o) => o.id === picked)
  useNumberKeys(opts.length, (i) => setPicked(opts[i]?.id ?? null), !busy)
  // Sizes run small to large, so ← / → step through them (from nothing picked, → starts at the smallest, ← at the largest).
  useArrowKeys((dir) => {
    const i = opts.findIndex((o) => o.id === picked)
    const next = i < 0 ? (dir > 0 ? 0 : opts.length - 1) : Math.min(opts.length - 1, Math.max(0, i + dir))
    setPicked(opts[next]?.id ?? null)
  }, !busy)
  const submit = () => chosen && respond({ field: 'glove', value: chosen.id, raw: chosen.label }, `Glove ${chosen.label}`)

  return (
    <>
      <Panel><HandFigure label={chosen?.sub ? convertProseUnits(chosen.sub, storeUnits).toUpperCase() : undefined} /></Panel>
      <div className="flex flex-col justify-center gap-4">
        <span id={groupId} className={cardLabelCls}>{block.prompt || FIELD_LABEL.glove}</span>
        <div role="group" aria-labelledby={groupId} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(opts.length, 5)}, minmax(0, 1fr))` }}>
          {opts.map((o, i) => {
            const on = o.id === picked
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={on}
                aria-keyshortcuts={i < 9 ? String(i + 1) : undefined}
                disabled={busy}
                onClick={() => setPicked(o.id)}
                className={cn(
                  'relative flex h-[72px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-12 border bg-white text-midnight transition-ui disabled:cursor-not-allowed disabled:opacity-60',
                  on ? 'border-midnight shadow-[inset_0_0_0_1px_#0B0B0B]' : 'border-grey-d9 hover:border-grey-8f',
                )}
              >
                <span className="font-display text-[28px] leading-none font-extrabold">{o.label}</span>
                {o.sub && <span className="text-[12px] text-grey-55">{convertProseUnits(o.sub, storeUnits)}</span>}
                {i < 9 && <Kbd className="absolute top-1 right-1 h-[18px] min-w-[18px] px-1 text-[11px]">{i + 1}</Kbd>}
              </button>
            )
          })}
        </div>
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
      </div>
    </>
  )
}
