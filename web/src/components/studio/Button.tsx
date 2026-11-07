import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Flow v3 button (spec §1.4 `.btn`). One `primary` (orange) per view. */
export type ButtonVariant = 'primary' | 'dark' | 'outline' | 'lightOnDark' | 'ghostOnDark'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl'

const base =
  'inline-flex items-center justify-center gap-2.5 rounded-6 border-0 font-display font-bold uppercase tracking-[0.04em] whitespace-nowrap no-underline cursor-pointer transition-ui disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-tiger-orange text-midnight hover:bg-orange-hover hover:text-midnight',
  dark: 'bg-midnight text-washed-white hover:text-white',
  outline: 'bg-transparent text-midnight shadow-[inset_0_0_0_1px_#C8C8C8] hover:shadow-[inset_0_0_0_1px_#0B0B0B]',
  lightOnDark: 'bg-washed-white text-midnight hover:bg-white',
  ghostOnDark: 'bg-transparent text-washed-white shadow-[inset_0_0_0_1px_#3D3D3D] hover:shadow-[inset_0_0_0_1px_#8F8F8F]',
}

// sm = in-card 40/15px, md = `.btn` 48/18px, lg = buy bar 54/21px, xl = big CTA 64/24px.
const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-[22px] text-[15px]',
  md: 'min-h-12 px-[22px] text-[18px]',
  lg: 'min-h-[54px] px-7 text-[21px]',
  xl: 'min-h-16 px-8 text-[24px]',
}

/** The class string, for a link or element that must look like a v3 button. */
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className)
}

interface Common {
  variant?: ButtonVariant
  size?: ButtonSize
  children?: ReactNode
}

export type ButtonProps =
  | (Common & ComponentProps<'button'> & { href?: undefined })
  | (Common & ComponentProps<'a'> & { href: string })

/** Renders a `<button type="button">`, or an `<a>` when `href` is given. */
export function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const { variant, size, className, ...rest } = props
    return <a {...rest} className={buttonClass(variant, size, className)} />
  }
  const { variant, size, className, type = 'button', ...rest } = props
  return <button type={type} {...rest} className={buttonClass(variant, size, className)} />
}
