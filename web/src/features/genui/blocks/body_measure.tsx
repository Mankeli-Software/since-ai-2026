import { useState } from 'react'
import diagrams from '../../../../../fixtures/diagrams.json'
import { Button } from '@/components/ui/button'
import { answeredCls, btnCls, chipCls, inputCls, promptCls } from '../ui'
import type { BlockProps } from '../types'

export const type = 'body_measure'

interface DiagramEntry {
  title?: string
  steps?: string[]
  caption?: string
}

const diagMap = diagrams as Record<string, DiagramEntry>

export function Component({ block, interactive, answer, busy, respond }: BlockProps<'body_measure'>) {
  const diag = diagMap[block.diagram_id ?? block.field] ?? diagMap[block.field]
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
    <div className="flex flex-col gap-3">
      <p className={promptCls}>{block.prompt}</p>
      {diag && (
        <div className="flex flex-col gap-1 text-sm text-ink-500">
          {diag.steps && (
            <ol className="list-decimal pl-5">
              {diag.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          )}
          {diag.caption && <p className="text-xs text-muted-foreground">{diag.caption}</p>}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input type="number" min={0} step="0.1" className={`${inputCls} w-28 font-display text-lg font-semibold`} value={raw} disabled={off} onChange={(e) => setRaw(e.target.value)} />
        {units.map((u) => (
          <button key={u} type="button" className={`${chipCls(unit === u)} px-3 uppercase`} disabled={off} onClick={() => setUnit(u)}>{u}</button>
        ))}
      </div>
      {interactive ? (
        <Button className={`self-start ${btnCls}`} disabled={off || !(n > 0)} onClick={submit}>Confirm</Button>
      ) : (
        answer && <p className={answeredCls}>Answered: <strong>{answer.displayText}</strong></p>
      )}
    </div>
  )
}
