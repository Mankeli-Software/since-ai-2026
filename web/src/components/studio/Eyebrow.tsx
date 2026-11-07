import type { ComponentProps, ElementType } from 'react'
import { cn } from '@/lib/utils'

/** `.eb` eyebrow: Barlow Condensed 600, .16em, uppercase. `size` 13 (default) or 11 (small). Colour via className. */
export interface EyebrowProps extends ComponentProps<'span'> {
  size?: 11 | 13
  /** Element to render, e.g. 'h2' or 'label'. Default 'span'. */
  as?: ElementType
}

export function Eyebrow({ size = 13, as: Tag = 'span', className, ...rest }: EyebrowProps) {
  return (
    <Tag
      {...rest}
      className={cn(
        'font-display font-semibold uppercase tracking-[0.16em]',
        size === 11 ? 'text-[11px]' : 'text-[13px]',
        className,
      )}
    />
  )
}
