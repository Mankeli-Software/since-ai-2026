import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Kbd } from './Kbd'

/**
 * `.opt` option tile: white, 60px, radius 12, border #D9D9D9; selected = 2px #0B0B0B border.
 * `kbd` shows the number key (the parent wires the keyboard shortcut). The state is exposed as aria-pressed.
 */
export interface OptTileProps extends Omit<ComponentProps<'button'>, 'children'> {
  selected?: boolean
  kbd?: number | string
  children: ReactNode
}

export function OptTile({ selected = false, kbd, className, type = 'button', children, ...rest }: OptTileProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      {...rest}
      className={cn(
        'flex min-h-[60px] cursor-pointer items-center gap-4 rounded-12 border bg-white px-[18px] text-left font-sans text-[19px] font-medium text-midnight transition-ui ring-1 ring-card-edge disabled:cursor-not-allowed disabled:opacity-50',
        // The 2px selected border without a layout shift: 1px border + 1px inset ring.
        selected ? 'border-midnight shadow-[inset_0_0_0_1px_var(--color-midnight,#0B0B0B)]' : 'border-grey-d9 hover:border-grey-8f',
        className,
      )}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {kbd !== undefined && <Kbd>{kbd}</Kbd>}
    </button>
  )
}
