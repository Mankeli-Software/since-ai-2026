import { useId, useState } from 'react'
import { Button, EnterKbd, ProvenancePill, useArrowKeys, useEnterKey } from '@/components/studio'
import type { BlockProps } from '../types'
import { Answered, BigNumber, cardLabelCls } from './_parts/Answered'
import { ArrowKbds, Range, stepValue } from './_parts/Range'
import { Segmented } from './_parts/Segmented'

export const type = 'slider'

const fmt = (n: number) => String(Math.round(n * 100) / 100)

/**
 * C3b `slider_guess`: label + provenance pill, big number, range, scale, guess/measured toggle,
 * Not sure / That's it (Enter). ← / → move the slider from anywhere on the page (Shift = 10 steps). Payload unchanged: `value`, or `{value, measured}` with the toggle; unknown = null.
 */
export function Component({ block, interactive, answer, busy, respond }: BlockProps<'slider'>) {
  const [value, setValue] = useState(block.value ?? Math.round((block.min + block.max) / 2 / block.step) * block.step)
  const [measured, setMeasured] = useState(false)
  const inputId = useId()

  const send = () => {
    const text = `${fmt(value)} ${block.unit}`
    if (block.measured_or_guessed_toggle) respond({ value, measured }, `${text} (${measured ? 'measured' : 'guess'})`)
    else respond(value, text)
  }
  useEnterKey(send, interactive && !answer && !busy)
  useArrowKeys((dir, big) => setValue((v) => stepValue(v, dir, big, block)), interactive && !answer && !busy)

  if (!interactive || answer) return <Answered prompt={block.prompt} answer={answer} />

  const mid = Math.round((block.min + block.max) / 2 / block.step) * block.step

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={inputId} className={cardLabelCls}>{block.prompt}</label>
        <span className="flex items-center gap-3">
          <ArrowKbds />
          {block.measured_or_guessed_toggle && <ProvenancePill kind={measured ? 'measured' : 'guess'} />}
        </span>
      </div>
      <BigNumber value={fmt(value)} unit={block.unit} />
      <Range
        id={inputId}
        min={block.min}
        max={block.max}
        step={block.step}
        value={value}
        disabled={busy}
        aria-keyshortcuts="ArrowLeft ArrowRight"
        aria-valuetext={`${fmt(value)} ${block.unit}`}
        onChange={(e) => setValue(Number(e.target.value))}
      />
      <div className="flex justify-between text-[14px] text-grey-55">
        <span>{fmt(block.min)} {block.unit}</span>
        <span>{fmt(mid)}</span>
        <span>{fmt(block.max)} {block.unit}</span>
      </div>
      <div className="flex items-center gap-3">
        {block.measured_or_guessed_toggle ? (
          <Segmented
            label="Where this number came from"
            options={[{ id: 'guess', label: "It's a guess" }, { id: 'measured', label: 'I measured it' }]}
            value={measured ? 'measured' : 'guess'}
            onChange={(v) => setMeasured(v === 'measured')}
            disabled={busy}
          />
        ) : (
          <span className="flex-1" />
        )}
        {block.allow_unknown && (
          <Button variant="outline" disabled={busy} onClick={() => respond(null, 'Not sure')}>Not sure</Button>
        )}
        <Button variant="dark" disabled={busy} aria-keyshortcuts="Enter" onClick={send} className="pr-3">
          That's it
          <EnterKbd />
        </Button>
      </div>
    </div>
  )
}
