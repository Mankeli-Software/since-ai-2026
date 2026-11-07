import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { answeredCls, btnCls, chipCls, eyebrowCls, inputCls, promptCls } from '../ui'
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
    <div className="flex flex-col gap-3">
      <p className={promptCls}>{block.prompt}</p>
      <div className="flex items-center gap-3 rounded-md border border-border bg-background px-4 py-3">
        <input
          type="range" className="h-1.5 flex-1 cursor-pointer accent-tiger-orange" min={block.min} max={block.max} step={block.step}
          value={value} disabled={off} onChange={(e) => setValue(Number(e.target.value))}
        />
        <input
          type="number" className={`${inputCls} w-20 text-center font-display text-lg font-semibold`} min={block.min} max={block.max} step={block.step}
          value={value} disabled={off} onChange={(e) => setValue(Number(e.target.value))}
        />
        <span className={eyebrowCls}>{block.unit}</span>
      </div>
      {block.measured_or_guessed_toggle && (
        <div className="flex gap-2 text-sm">
          {[false, true].map((m) => (
            <button key={String(m)} type="button" className={chipCls(measured === m)} disabled={off} onClick={() => setMeasured(m)}>
              {m ? 'Measured' : 'My guess'}
            </button>
          ))}
        </div>
      )}
      {interactive || !shown ? (
        <div className="flex gap-2">
          <Button className={btnCls} disabled={off} onClick={send}>Confirm</Button>
          {block.allow_unknown && (
            <Button variant="outline" className={btnCls} disabled={off} onClick={() => respond(null, "I don't know")}>I don't know</Button>
          )}
        </div>
      ) : (
        <p className={answeredCls}>Answered: <strong>{shown}</strong></p>
      )}
    </div>
  )
}
