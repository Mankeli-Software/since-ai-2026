import type { UIBlock } from '@/api/client'
import { Button, CloseCallBar, Eyebrow, type CloseCallSide } from '@/components/studio'
import { Text } from '@/features/chat/Text'
import { cn } from '@/lib/utils'

type Part = Extract<UIBlock, { type: 'close_call' }>['part']

export interface CloseCallViewProps {
  part: Part
  /** The fit's pick (orange share) and the runner-up (grey share). Shares are integer percents. */
  a: CloseCallSide
  b: CloseCallSide
  /** Trade-off sentence; `**bold**` and line breaks only. */
  tradeoff: string
  /** Optional action label. Shown disabled ("coming soon"): there is no action contract yet. */
  next_step?: string | null
  /** Draw the light card (bg #F8F8F8, r14, padding 16). Default true, so it also reads on the dark aside. */
  framed?: boolean
  className?: string
}

const PART_LABEL: Record<Part, string> = {
  head: 'head',
  flex: 'flex',
  material: 'shaft material',
  shaft_model: 'shaft',
  length: 'length',
  lie: 'lie',
  grip: 'grip',
  purchase: 'stock or custom',
  handedness: 'handedness',
}

/** Close call (R3 aside, K5): split bar + trade-off, not a winner. Always light. */
export function CloseCallView({ part, a, b, tradeoff, next_step, framed = true, className }: CloseCallViewProps) {
  return (
    <section
      aria-label={`Close call: ${PART_LABEL[part]}`}
      className={cn(
        'flex flex-col gap-2.5 text-midnight',
        framed && 'rounded-14 bg-washed-white p-4',
        className,
      )}
    >
      <Eyebrow className="text-grey-55">Close call: {PART_LABEL[part]}</Eyebrow>
      <CloseCallBar tone="light" a={a} b={b} />
      <p className="m-0 text-[14px] leading-[1.45] [&_strong]:font-bold">
        <Text text={tradeoff} />
      </p>
      {next_step && (
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" disabled title="Coming soon">
            {next_step}
          </Button>
          <span className="text-[13px] text-grey-55">Coming soon</span>
        </div>
      )}
    </section>
  )
}
