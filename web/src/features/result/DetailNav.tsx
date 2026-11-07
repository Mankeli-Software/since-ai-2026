import { ClubImage } from '@/components/studio'
import { cn } from '@/lib/utils'
import { ViewLink, type ResultsView } from './chrome'

const TABS: { view: ResultsView; n: number; label: string }[] = [
  { view: 'why', n: 1, label: 'Why each part' },
  { view: 'compare', n: 2, label: 'Compare heads, see it fly' },
  { view: 'ar', n: 3, label: 'In your hands' },
]

/** Detail nav (spec §2.2, R2–R5): back pill to the summary + three tabs. Not shown on the summary. */
export function DetailNav({ view, head }: { view: ResultsView; head: string | null }) {
  return (
    <nav aria-label="Dig into your fit" className="flex flex-none items-center gap-2 px-10 pt-4">
      <ViewLink
        view="summary"
        className="mr-2 inline-flex h-10 items-center gap-2 rounded-full bg-grey-1a pr-3.5 pl-2.5 text-[15px] font-semibold whitespace-nowrap text-washed-white no-underline transition-ui hover:bg-grey-26"
      >
        {head && <ClubImage slug={head} className="h-[30px] w-auto" />}← Your fit
      </ViewLink>
      {TABS.map((t) => {
        const active = t.view === view
        return (
          <ViewLink
            key={t.view}
            view={t.view}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-10 items-center gap-2 rounded-full px-3.5 no-underline transition-ui',
              active
                ? 'bg-washed-white text-midnight hover:text-midnight'
                : 'text-grey-a3 shadow-[inset_0_0_0_1px_var(--color-grey-26)] hover:text-washed-white hover:shadow-[inset_0_0_0_1px_var(--color-grey-3d)]',
            )}
          >
            <span className={cn('font-display text-[16px] font-extrabold tabular-nums', active ? 'text-orange-text' : 'text-grey-5f')}>
              {t.n}
            </span>
            <span className="text-[15px] font-semibold whitespace-nowrap">{t.label}</span>
          </ViewLink>
        )
      })}
    </nav>
  )
}
