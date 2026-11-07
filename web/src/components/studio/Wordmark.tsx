import { cn } from '@/lib/utils'

/** "TAKOMO" wordmark: Barlow 600 19px, letter-spacing .3em. Inherits colour. */
export function Wordmark({ className }: { className?: string }) {
  return <span className={cn('font-sans text-[19px] font-semibold tracking-[0.3em]', className)}>TAKOMO</span>
}
