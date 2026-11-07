import { cn } from '@/lib/utils'

/**
 * "You told me" recap chip (dark): 34px pill, #161616, border #262626, 15px #C8C8C8.
 * `title` is the question it answered (native tooltip); `measured` adds a leading 7px orange dot.
 */
export interface RecapChipProps {
  label: string
  title?: string
  measured?: boolean
  className?: string
}

export function RecapChip({ label, title, measured = false, className }: RecapChipProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-[34px] max-w-full items-center gap-2 rounded-full border border-page-line bg-panel-2 px-3.5 font-sans text-[15px] text-on-page-2',
        className,
      )}
    >
      {measured && (
        <>
          <span aria-hidden="true" className="size-[7px] flex-none rounded-full bg-tiger-orange" />
          <span className="sr-only">Measured: </span>
        </>
      )}
      <span className="truncate">{label}</span>
    </span>
  )
}
