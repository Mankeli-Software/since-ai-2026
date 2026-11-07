import { Kbd, useNumberKeys } from '@/components/studio'
import { cn } from '@/lib/utils'
import type { BlockOf, BlockProps } from '../types'

export const type = 'yes_no_fork'

type Illustration = BlockOf<'yes_no_fork'>['options'][number]['illustration']

const DOTS: [number, number][] = [
  [150, 52], [162, 44], [140, 62], [170, 58], [156, 66], [146, 40], [176, 48], [160, 56], [134, 50], [166, 70],
]

/** The two C4a thumbnails (V3-C4a-Sim), 300x110. Decorative. */
function Art({ kind }: { kind: Illustration }) {
  if (kind === 'sim_data') {
    return (
      <svg viewBox="0 0 300 110" className="w-full rounded-10 bg-midnight" aria-hidden="true">
        <path d="M20 96 C 70 14 130 10 160 56" fill="none" stroke="#5F5F5F" strokeWidth="1.5" strokeDasharray="4 5" />
        <ellipse cx="156" cy="55" rx="30" ry="20" fill="#FF6E01" fillOpacity=".1" stroke="#FF6E01" />
        {DOTS.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4" fill="#FF6E01" />
        ))}
        <line x1="20" y1="98" x2="280" y2="98" stroke="#2A2A2A" />
        <text x="200" y="40" fill="#F8F8F8" fontFamily="Barlow Condensed" fontWeight="700" fontSize="20">
          142 M
        </text>
        <text x="200" y="60" fill="#FF8A33" fontFamily="Barlow Condensed" fontWeight="600" fontSize="13" letterSpacing="1.5">
          MEASURED
        </text>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 300 110" className="w-full rounded-10 bg-grey-ed" aria-hidden="true">
      <rect x="30" y="22" width="150" height="34" rx="17" fill="#FFFFFF" />
      <text x="48" y="44" fill="#555555" fontFamily="Barlow" fontSize="14">
        About 165, I think
      </text>
      <rect x="120" y="64" width="150" height="30" rx="15" fill="#0B0B0B" />
      <text x="138" y="84" fill="#F8F8F8" fontFamily="Barlow" fontSize="13">
        Mostly a fade, a bit low
      </text>
      <circle cx="250" cy="38" r="14" fill="none" stroke="#8F8F8F" strokeWidth="1.5" strokeDasharray="3 3" />
      <text x="244" y="43" fill="#8F8F8F" fontFamily="Barlow Condensed" fontWeight="700" fontSize="14">
        ?
      </text>
    </svg>
  )
}

/** C4a visual fork: two illustrated tiles; a tap sends the option id. Number keys 1/2 pick too. */
export function Component({ block, interactive, answer, busy, respond }: BlockProps<'yes_no_fork'>) {
  const live = interactive && !answer
  const pick = (i: number) => respond(block.options[i].id, block.options[i].title)
  useNumberKeys(block.options.length, pick, live && !busy)

  if (!live) {
    const picked = block.options.find((o) => o.id === answer?.value)
    return (
      <p className="m-0 text-[15px] text-grey-55">
        {block.prompt}{' '}
        <strong className="font-semibold text-midnight">{picked?.title ?? answer?.displayText ?? 'Not answered'}</strong>
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div role="group" aria-label={block.prompt} className="grid grid-cols-2 gap-3.5">
        {block.options.map((o, i) => {
          return (
            <button
              key={o.id}
              type="button"
              // Nothing is picked while live: a tap answers at once and the card turns read-only.
              aria-pressed={false}
              aria-keyshortcuts={String(i + 1)}
              disabled={busy}
              onClick={() => pick(i)}
              className={cn(
                'flex cursor-pointer flex-col gap-3.5 rounded-16 border border-grey-d9 bg-white p-5 text-left text-midnight transition-ui disabled:cursor-not-allowed disabled:opacity-50',
                'enabled:hover:border-midnight enabled:hover:shadow-[inset_0_0_0_1px_#0B0B0B]',
              )}
            >
              <Art kind={o.illustration} />
              <span className="flex flex-col gap-1">
                <span className="flex items-center justify-between gap-3">
                  <span className="font-display text-[26px] font-bold uppercase">{o.title}</span>
                  <Kbd>{i + 1}</Kbd>
                </span>
                <span className="text-[15px] leading-[1.45] text-grey-55">{o.body}</span>
              </span>
            </button>
          )
        })}
      </div>
      {block.footnote && <p className="m-0 text-[15px] text-grey-33 underline">{block.footnote}</p>}
    </div>
  )
}
