import { chipCls, promptCls } from '../ui'
import type { BlockProps } from '../types'

export const type = 'choice_chips'

/** Reference block: copy this shape for every new block. */
export function Component({ block, interactive, answer, busy, respond }: BlockProps<'choice_chips'>) {
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
    </div>
  )
}
