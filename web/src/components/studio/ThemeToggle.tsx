import type { ComponentProps } from 'react'
import { hasFlag } from '@/lib/flags'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

export type ThemeToggleProps = Omit<ComponentProps<'button'>, 'children' | 'onClick'>

export function ThemeToggle({ className, ...rest }: ThemeToggleProps) {
  const [theme, toggle] = useTheme()
  if (!hasFlag('light-mode')) return null
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={!isDark}
      {...rest}
      className={cn(
        'inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-6 border-0 bg-transparent text-on-page transition-ui hover:text-orange-on-page',
        className,
      )}
    >
      {isDark ? (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </button>
  )
}
