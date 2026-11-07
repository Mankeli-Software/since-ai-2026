import { ClubImage, Eyebrow } from '@/components/studio'
import { cn } from '@/lib/utils'
import { ExamplePill } from '../chrome'
import { STATUS_TOOLTIP } from '../fixtures/commerce'
import { headName } from '../specLabel'
import type { Spec } from '../types'
import { exampleAvailability } from './availability'
import { num, type HeadOption } from './pair'

const RANK_LABEL: Record<HeadOption['rank'], string> = {
  best: '1st, your fit',
  runner: '2nd, close behind',
  other: 'Compared',
}

export interface HeadSelectorProps {
  options: HeadOption[]
  selected: string
  onSelect(head: string): void
  /** The fit's shaft, for the example availability line. */
  shaft: Spec['shaft'] | undefined
}

/** R3 "Tap a head to see it fly": two toggle buttons (aria-pressed) with image, rank, score, example stock line. */
export function HeadSelector({ options, selected, onSelect, shaft }: HeadSelectorProps) {
  return (
    <section aria-labelledby="head-selector" className="flex flex-col gap-2">
      <Eyebrow as="h2" id="head-selector" className="m-0 text-on-page-3">
        Tap a head to see it fly
      </Eyebrow>
      <div className="flex gap-3 max-md:flex-col max-md:gap-2.5">
        {options.map((o) => {
          const on = o.head === selected
          const first = o.rank === 'best'
          const avail = exampleAvailability(o.head, shaft)
          return (
            <button
              key={o.head}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(o.head)}
              className={cn(
                'flex min-w-0 flex-1 cursor-pointer items-center gap-3.5 rounded-14 px-4 py-3 text-left font-sans text-on-page transition-ui',
                on ? 'border-2 border-tiger-orange bg-selected-dark' : 'border border-page-line-2 bg-panel hover:border-page-line-2',
              )}
            >
              <ClubImage slug={o.head} className="h-[70px] w-auto flex-none max-md:h-14" />
              <span className="flex min-w-0 flex-col gap-[3px]">
                <Eyebrow className={first ? 'text-orange-on-page' : 'text-on-page-3'}>{RANK_LABEL[o.rank]}</Eyebrow>
                <span className="font-display text-[22px] font-bold uppercase">
                  {headName(o.head)}
                  {o.row && (
                    <span title="Fit score" className={cn('ml-1.5 tabular-nums', first ? 'text-orange-on-page' : 'text-on-page-2')}>
                      <span className="sr-only">, fit score </span>
                      {num(o.row.score_total)}
                    </span>
                  )}
                </span>
                <span title={STATUS_TOOLTIP} className="inline-flex min-w-0 flex-wrap items-center gap-1.5 text-[13px] text-on-page-2">
                  <span
                    aria-hidden="true"
                    className={cn('size-[7px] flex-none rounded-full', avail.tone === 'green' ? 'bg-status-green' : 'bg-status-amber')}
                  />
                  <span>{avail.text}</span>
                  <ExamplePill />
                  <span className="text-[11px] text-on-page-3">example; real stock comes from Takomo&apos;s inventory</span>
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
