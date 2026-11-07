import { cn } from '@/lib/utils'
import { Kbd } from './Kbd'

/**
 * The `Enter ↵` hint inside a card's primary button (the parent wires `useEnterKey` and sets
 * `aria-keyshortcuts="Enter"` on the button). `tone` follows the button: dark, light/outline, or orange primary.
 */
export function EnterKbd({ tone = 'dark', className }: { tone?: 'dark' | 'light' | 'primary'; className?: string }) {
  return (
    <Kbd
      onDark={tone === 'dark'}
      className={cn('ml-1.5 normal-case tracking-normal', tone === 'primary' && 'bg-midnight/10 text-midnight', className)}
    >
      Enter ↵
    </Kbd>
  )
}
