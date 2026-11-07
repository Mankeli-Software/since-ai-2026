import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { inputCls } from '../ui'
import type { BlockProps } from '../types'

export const type = 'body_measure'

// shortcut: switch to fixtures/diagrams.json (#41) when it lands; short inline hints until then.
const HINTS: Record<string, string> = {
  height: 'Stand straight against a wall, shoes off. Mark the top of your head.',
  wrist_to_floor: 'Stand straight, arms relaxed. Measure from the wrist crease to the floor.',
  hand_length: 'Open your hand flat. Measure from the wrist crease to the tip of the middle finger.',
}

export function Component({ block, interactive, answer, busy, respond }: BlockProps<'body_measure'>) {
  const units = block.unit_options?.length ? block.unit_options : (['cm', 'in'] as const)
  const [unit, setUnit] = useState<'cm' | 'in'>(units[0])
  const [raw, setRaw] = useState(block.value == null ? '' : String(block.value))
  const off = !interactive || busy
  const n = Number(raw)
  const submit = () => {
    const cm = unit === 'in' ? n * 2.54 : n
    respond({ field: block.field, value_cm: Math.round(cm * 10) / 10, unit, raw: n }, `${n} ${unit}`)
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="font-semibold">{block.prompt}</p>
      <p className="text-xs text-muted-foreground">{HINTS[block.field]}</p>
      <div className="flex items-center gap-2">
        <input type="number" min={0} step="0.1" className={`${inputCls} w-28`} value={raw} disabled={off} onChange={(e) => setRaw(e.target.value)} />
        {units.map((u) => (
          <Button key={u} size="sm" variant={unit === u ? 'default' : 'secondary'} disabled={off} onClick={() => setUnit(u)}>{u}</Button>
        ))}
      </div>
      {interactive ? (
        <Button className="self-start" disabled={off || !(n > 0)} onClick={submit}>Confirm</Button>
      ) : (
        answer && <p className="text-sm">Answered: <strong>{answer.displayText}</strong></p>
      )}
    </div>
  )
}
