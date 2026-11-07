import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { answeredCls, btnCls, chipCls, promptCls } from '../ui'
import type { BlockProps } from '../types'

export const type = 'choice_chips'

/** Reference block: copy this shape for every new block. */
export function Component({ block, interactive, answer, busy, respond }: BlockProps<'choice_chips'>) {
  const [selected, setSelected] = useState<string[]>(() => {
    if (Array.isArray(answer?.value)) return answer.value.map(String)
    return []
  })

  if (!block.multi) {
    return (
      <div className="flex flex-wrap gap-2">
        <p className={`w-full ${promptCls}`}>{block.prompt}</p>
        {block.options.map((o) => {
          const picked = answer?.value === o.id
          return (
            <button
              key={o.id}
              type="button"
              className={chipCls(picked)}
              disabled={!interactive || busy}
              title={o.hint ?? undefined}
              onClick={() => respond(o.id, o.label)}
            >
              {o.label}
            </button>
          )
        })}
        {!interactive && answer && (
          <p className={`w-full ${answeredCls}`}>
            Answered: <strong>{answer.displayText}</strong>
          </p>
        )}
      </div>
    )
  }

  const toggle = (id: string) => {
    if (id === 'none') {
      setSelected((prev) => (prev.includes('none') ? [] : ['none']))
      return
    }
    setSelected((prev) => {
      const clean = prev.filter((x) => x !== 'none')
      if (clean.includes(id)) {
        return clean.filter((x) => x !== id)
      }
      if (block.field === 'characteristics' && clean.length >= 3) {
        return clean
      }
      return [...clean, id]
    })
  }

  const submit = () => {
    const list = selected.length === 0 && block.field === 'joint_pain' ? ['none'] : selected
    const labels = list
      .map((id) => block.options.find((o) => o.id === id)?.label ?? id)
      .join(', ')
    respond(list, labels || 'None')
  }

  const answeredList = Array.isArray(answer?.value) ? (answer.value as string[]) : selected

  return (
    <div className="flex flex-col gap-3">
      <p className={`w-full ${promptCls}`}>{block.prompt}</p>
      <div className="flex flex-wrap gap-2">
        {block.options.map((o) => {
          const picked = interactive ? selected.includes(o.id) : answeredList.includes(o.id)
          return (
            <button
              key={o.id}
              type="button"
              className={chipCls(picked)}
              disabled={!interactive || busy}
              title={o.hint ?? undefined}
              onClick={() => toggle(o.id)}
            >
              {o.label}
            </button>
          )
        })}
      </div>
      {interactive ? (
        <div className="flex items-center gap-2">
          <Button className={btnCls} disabled={busy} onClick={submit}>
            {selected.length === 0 ? 'Skip / None' : 'Confirm'}
          </Button>
        </div>
      ) : (
        answer && (
          <p className={answeredCls}>
            Answered: <strong>{answer.displayText}</strong>
          </p>
        )
      )}
    </div>
  )
}
