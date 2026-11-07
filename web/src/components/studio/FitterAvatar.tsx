import { cn } from '@/lib/utils'
import { LogoMark } from './LogoMark'

export type FitterAvatarSize = 28 | 36 | 44

/** Fitter avatar: orange circle with the black logo mark. 44 chat, 36 aside, 28 inline. Decorative. */
export interface FitterAvatarProps {
  size?: FitterAvatarSize
  className?: string
}

const markSize: Record<FitterAvatarSize, number> = { 28: 16, 36: 20, 44: 24 }

export function FitterAvatar({ size = 44, className }: FitterAvatarProps) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={cn('inline-flex flex-none items-center justify-center rounded-full bg-tiger-orange', className)}
    >
      <LogoMark size={markSize[size]} color="#0B0B0B" />
    </span>
  )
}
