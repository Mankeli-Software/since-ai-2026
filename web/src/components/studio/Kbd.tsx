import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** `.kbd` number-key hint (26px, #EDEDED / #333). `onDark` for dark tiles. Decorative: aria-hidden. */
export interface KbdProps extends ComponentProps<'kbd'> {
  onDark?: boolean
}

export function Kbd({ onDark = false, className, ...rest }: KbdProps) {
  return (
    <kbd
      aria-hidden="true"
      {...rest}
      className={cn(
        'inline-flex h-[26px] min-w-[26px] flex-none items-center justify-center rounded-6 px-1.5 font-sans text-[14px] font-semibold',
        onDark ? 'bg-grey-26 text-grey-c8' : 'bg-grey-ed text-grey-33',
        className,
      )}
    />
  )
}
