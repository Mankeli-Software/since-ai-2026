import { FitterAvatar } from '@/components/studio'
import { Text } from '../chat/Text'
import { useResultsChrome, type ResultsView, type WhyPart } from './chrome'

/**
 * Phone-only pieces of the results views (mockups M-R2 / M-R3 / M-R4). Both are `md:hidden`: on desktop the
 * buy bar carries "Next: … →" and the aside carries the fitter's note.
 */

/** "Next / LENGTH ›" card at the bottom of a view: the phone buy bar has no room for the Next link. */
export function PhoneNext({ label, to }: { label: string; to: { view: ResultsView; part?: WhyPart } }) {
  const { go } = useResultsChrome()
  return (
    <button
      type="button"
      onClick={() => go(to.view, to.part)}
      className="flex min-h-[60px] w-full flex-none cursor-pointer items-center gap-3 rounded-12 border border-grey-26 bg-grey-12 px-4 text-left text-washed-white md:hidden"
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-[13px] text-grey-a3">Next</span>
        <span className="font-display text-[18px] font-bold uppercase">{label}</span>
      </span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF8A33" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ml-auto">
        <path d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

/** The fitter's one-line note, inline on the page (the sheet is closed by default on phones). */
export function PhoneNote({ text }: { text: string }) {
  return (
    <div className="flex flex-none items-start gap-3 rounded-12 border border-grey-26 bg-grey-12 p-4 md:hidden">
      <FitterAvatar size={28} className="mt-0.5" />
      <p className="m-0 text-[16px] leading-[1.45] text-washed-white">
        <Text text={text} />
      </p>
    </div>
  )
}
