import { cn } from '@/lib/utils'

/**
 * v3 segmented control (C3b, C6a): #EDEDED track r10 pad 4; active thumb white r8 + shadow, 600;
 * inactive transparent 500 #333. Buttons expose aria-pressed. Helper for input blocks, not a block.
 */
export function Segmented<T extends string>(p: {
  label: string
  options: readonly { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
  disabled?: boolean
  /** 'md' = 46px tall, stretches (C3b); 'sm' = 40px, 64px min per button (C6a unit switch). */
  size?: 'sm' | 'md'
  className?: string
}) {
  const sm = p.size === 'sm'
  return (
    <div
      role="group"
      aria-label={p.label}
      className={cn('flex rounded-10 bg-grey-ed p-1', sm ? 'self-start' : 'flex-1', p.className)}
    >
      {p.options.map((o) => {
        const on = o.id === p.value
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            disabled={p.disabled}
            onClick={() => p.onChange(o.id)}
            className={cn(
              'cursor-pointer rounded-8 border-0 px-3 font-sans text-midnight transition-ui disabled:cursor-not-allowed disabled:opacity-60',
              sm ? 'h-10 min-w-16 text-[15px]' : 'h-[46px] flex-1 text-[16px]',
              on ? 'bg-white font-semibold shadow-thumb' : 'bg-transparent font-medium text-grey-33',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
