import { Button } from '@/components/ui/button'
import type { BlockProps } from '../types'

export const type = 'choice_chips'

/** Reference block: copy this shape for every new block. */
export function Component({ block, interactive, answer, busy, respond }: BlockProps<'choice_chips'>) {
  return (
    <div className="flex flex-wrap gap-2">
      <p className="w-full font-semibold">{block.prompt}</p>
      {block.options.map((o) => {
        const picked = answer?.value === o.id
        return (
          <Button
            key={o.id}
            variant={picked ? 'default' : 'secondary'}
            disabled={!interactive || busy}
            title={o.hint ?? undefined}
            onClick={() => respond(o.id, o.label)}
          >
            {o.label}
          </Button>
        )
      })}
    </div>
  )
}
