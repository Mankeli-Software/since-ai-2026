import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { inputCls } from '../ui'
import type { BlockProps } from '../types'

export const type = 'slider'

export function Component({ block, interactive, answer, busy, respond }: BlockProps<'slider'>) {
  const [value, setValue] = useState(block.value ?? (block.min + block.max) / 2)
  const [measured, setMeasured] = useState(false)
  const off = !interactive || busy
  const shown = answer ? (answer.displayText) : null
  const send = () => {
    const text = `${value} ${block.unit}`
    if (block.measured_or_guessed_toggle) respond({ value, measured }, `${text} (${measured ? 'measured' : 'guess'})`)
    else respond(value, text)
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="font-semibold">{block.prompt}</p>
      <div className="flex items-center gap-3">
        <input
          type="range" className="flex-1 accent-accent" min={block.min} max={block.max} step={block.step}
          value={value} disabled={off} onChange={(e) => setValue(Number(e.target.value))}
        />
        <input
          type="number" className={`${inputCls} w-20`} min={block.min} max={block.max} step={block.step}
          value={value} disabled={off} onChange={(e) => setValue(Number(e.target.value))}
        />
        <span className="text-sm text-muted-foreground">{block.unit}</span>
      </div>
      {block.measured_or_guessed_toggle && (
        <div className="flex gap-2 text-sm">
          {[false, true].map((m) => (
            <Button key={String(m)} size="sm" variant={measured === m ? 'default' : 'secondary'} disabled={off} onClick={() => setMeasured(m)}>
              {m ? 'Measured' : 'My guess'}
            </Button>
          ))}
        </div>
      )}
      {interactive || !shown ? (
        <div className="flex gap-2">
          <Button disabled={off} onClick={send}>Confirm</Button>
          {block.allow_unknown && (
            <Button variant="secondary" disabled={off} onClick={() => respond(null, "I don't know")}>I don't know</Button>
          )}
        </div>
      ) : (
        <p className="text-sm">Answered: <strong>{shown}</strong></p>
      )}
    </div>
  )
}
