import { ClubImage } from '@/components/studio'
import { cn } from '@/lib/utils'
import { ViewLink, type ResultsView } from './chrome'

const TABS: { view: ResultsView; n: number; label: string; short: string }[] = [
  { view: 'why', n: 1, label: 'Why each part', short: 'Why' },
  { view: 'compare', n: 2, label: 'Compare heads, see it fly', short: 'Compare' },
  { view: 'ar', n: 3, label: 'In your hands', short: 'In your hands' },
]

/** Sideways swipe row with a fade at the right edge, so it is clear there is more (M-00 rule 6). */
const swipeRow =
  'max-md:overflow-x-auto max-md:[scrollbar-width:none] max-md:[mask-image:linear-gradient(90deg,#000_88%,transparent)] max-md:[&::-webkit-scrollbar]:hidden'

/**
 * Detail nav (spec §2.2, R2–R5): back pill to the summary + three tabs. Not shown on the summary.
 * Phones (M-R2): the back pill moves to the header chevron and the tabs become a swipe row with short labels.
 */
export function DetailNav({ view, head }: { view: ResultsView; head: string | null }) {
  return (
    <nav aria-label="Dig into your fit" className={cn('flex flex-none items-center gap-2 px-10 pt-4 max-md:px-4 max-md:pt-1 max-md:pb-1', swipeRow)}>
      <ViewLink
        view="summary"
        className="mr-2 inline-flex h-10 items-center gap-2 rounded-full bg-grey-1a pr-3.5 pl-2.5 text-[15px] font-semibold whitespace-nowrap text-washed-white no-underline transition-ui hover:bg-grey-26 max-md:hidden"
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
              'flex h-10 flex-none items-center gap-2 rounded-full px-3.5 no-underline transition-ui max-md:h-11',
              active
                ? 'bg-washed-white text-midnight hover:text-midnight'
                : 'text-grey-a3 shadow-[inset_0_0_0_1px_var(--color-grey-26)] hover:text-washed-white hover:shadow-[inset_0_0_0_1px_var(--color-grey-3d)]',
            )}
          >
            <span className={cn('font-display text-[16px] font-extrabold tabular-nums', active ? 'text-orange-text' : 'text-grey-5f')}>
              {t.n}
            </span>
            <span className="text-[15px] font-semibold whitespace-nowrap max-md:hidden">{t.label}</span>
            <span className="text-[15px] font-semibold whitespace-nowrap md:hidden">{t.short}</span>
          </ViewLink>
        )
      })}
    </nav>
  )
}
