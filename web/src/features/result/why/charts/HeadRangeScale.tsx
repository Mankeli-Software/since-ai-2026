import { ClubImage } from '@/components/studio'
import { cn } from '@/lib/utils'
import { headName } from '../../specLabel'
import { ChartPanel } from './ChartPanel'

/**
 * Catalog order (assets/clubs/manifest.json `headOrder`), which runs from the most forgiving to the most
 * workable head (takomo_products.json `ratings.forgiveness` falls 5 → 1 and `ratings.workability` rises
 * 2 → 5 along it). Evenly spaced: the scale shows the order, not a measured distance.
 */
const HEADS = ['101-mkii', '201-mkii', '201t-mkii', '301-cb', '301-mb']

/** 9–91 % so the end heads stay inside the panel. */
const position = (i: number) => 9 + (i / (HEADS.length - 1)) * 82

const short = (slug: string) => headName(slug).replace(/\s+MkII$/i, '')

/** R2 head: the five heads on one forgiving ↔ workable scale, yours in orange. */
export function HeadRangeScale({ best }: { best: string }) {
  const summary = `Takomo heads from more forgiving to more workable: ${HEADS.map(short).join(', ')}. Yours: ${short(best)}.`
  return (
    <ChartPanel title="Where it sits in the range">
      <div role="img" aria-label={summary} className="relative h-[170px]">
        {HEADS.map((slug, i) => {
          const yours = slug === best
          return (
            <div
              key={slug}
              aria-hidden="true"
              className="absolute bottom-[30px] flex -translate-x-1/2 flex-col items-center gap-1.5"
              style={{ left: `${position(i)}%` }}
            >
              <ClubImage
                slug={slug}
                className={cn('w-auto', yours ? 'h-[88px] drop-shadow-[0_10px_18px_rgba(255,110,1,.25)]' : 'h-[70px] opacity-45')}
              />
              <span className={cn('font-display text-[16px] font-bold whitespace-nowrap', yours ? 'text-orange-hover' : 'text-grey-a3')}>
                {short(slug)}
              </span>
            </div>
          )
        })}
        <div aria-hidden="true" className="absolute right-0 bottom-3 left-0 h-1 rounded-[2px] bg-[linear-gradient(90deg,#3D3D3D,#8F8F8F)]" />
        <div aria-hidden="true" className="absolute right-0 -bottom-2 left-0 flex justify-between text-[13px] text-grey-a3">
          <span>More forgiving</span>
          <span>More workable</span>
        </div>
      </div>
    </ChartPanel>
  )
}
