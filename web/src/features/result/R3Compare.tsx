import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Eyebrow, StatTile } from '@/components/studio'
import { FlightCompare } from '../flight'
import { ResultsAside, ResultsNext, useResultsChrome } from './chrome'
import { HeadSelector } from './compare/HeadSelector'
import { HeadStage } from './compare/HeadStage'
import { comparePair, num, shortHead, type CompareRow, type HeadOption } from './compare/pair'
import { VideoTile } from './compare/VideoTile'
import { PhoneNext, PhoneNote } from './PhoneBits'
import { headName, shaftLabel } from './specLabel'
import { CloseCallView } from './views/CloseCallView'

// Lazy so three.js only loads when "Show all five heads" is opened.
const ClubRow = lazy(() => import('../stage3d/ClubRow'))

const ASIDE_MESSAGE =
  "I kept your shaft and only swapped the head. That's how a fitter does it at the range: one change at a time."

const ALL_HEADS = ['101-mkii', '201-mkii', '201t-mkii', '301-cb', '301-mb']

/** "What about the 101?" / "Why not the 301?" for the head families not on screen. */
function chipsFor(shown: string[]): string[] {
  const shownShort = new Set(shown.map(shortHead))
  const others = [...new Set(ALL_HEADS.map(shortHead))].filter((s) => !shownShort.has(s))
  return [others[0] && `What about the ${others[0]}?`, others[1] && `Why not the ${others[1]}?`].filter((c): c is string => !!c)
}

function flightSummary(sel: CompareRow, other: CompareRow | null) {
  const line = (r: CompareRow) =>
    `${headName(r.head)} carries ${num(r.carry)} yards, apex ${num(r.apex)} yards, lands at ${num(r.land_angle)} degrees.`
  return `Estimated side view. ${line(sel)}${other ? ` ${line(other)}` : ''}`
}

function CompareTiles({ sel, other }: { sel: CompareRow; other: CompareRow | null }) {
  return (
    <div className="grid grid-cols-4 gap-2.5 max-md:grid-cols-2">
      <StatTile tone="dark" label="Carry" value={num(sel.carry)} compare={other ? num(other.carry) : undefined} unit="yd" />
      <StatTile tone="dark" label="Apex" value={num(sel.apex)} compare={other ? num(other.apex) : undefined} unit="yd" />
      <StatTile tone="dark" label="Landing" value={`${num(sel.land_angle)}°`} compare={other ? `${num(other.land_angle)}°` : undefined} />
      <StatTile tone="dark" label="Side spread" value={`±${num(sel.side_sd)}`} compare={other ? `±${num(other.side_sd)}` : undefined} unit="yd" />
    </div>
  )
}

function FlightPanel({ sel, other, guessed }: { sel: HeadOption; other: HeadOption | null; guessed: boolean }) {
  if (!sel.row) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-2 rounded-16 border border-grey-26 bg-grey-12 px-[18px] py-4">
        <Eyebrow className="text-grey-a3">Your swing, side view</Eyebrow>
        <p className="m-0 text-[15px] text-grey-c8">The flight comparison shows up here once I've run both heads for you.</p>
      </div>
    )
  }
  const rows = [sel.row, other?.row].filter((r): r is CompareRow => !!r)
  return (
    <>
      <div className="rounded-16 border border-grey-26 bg-grey-12 px-[18px] pt-3 pb-1 max-md:px-3.5">
        <div className="flex items-baseline justify-between gap-4 max-md:flex-wrap max-md:gap-x-3 max-md:gap-y-0.5">
          <Eyebrow className="text-grey-a3">Your swing, side view</Eyebrow>
          <span title={guessed ? 'Dashed: your carry is a guess. Import shots to measure it.' : 'Arcs drawn from carry, apex and landing angle, not a simulated flight'} className="text-[12px] text-grey-8f">
            {guessed ? 'Estimate · dashed = guessed carry' : 'Estimate'}
          </span>
        </div>
        <FlightCompare
          className="block w-full"
          guessed={guessed}
          selected={sel.head}
          arcs={rows.map((r) => ({ id: r.head, label: shortHead(r.head), carry: r.carry, apex: r.apex, land_angle: r.land_angle }))}
          ariaLabel={flightSummary(sel.row, other?.row ?? null)}
        />
      </div>
      <CompareTiles sel={sel.row} other={other?.row ?? null} />
    </>
  )
}

/**
 * R3 "Compare heads, see it fly" (V3-R3-Compare): same shaft, two heads, the selected one's flight in orange.
 * Phones (M-R3): one column, no head photo panel, the fitter's note inline and a Next card at the bottom.
 */
export function R3Compare() {
  const { data } = useResultsChrome()
  const guessed = (data.state?.shots ?? []).length === 0
  const options = comparePair(data)
  const [picked, setPicked] = useState<string | null>(null)
  const [showRow, setShowRow] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (showRow) rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [showRow])

  const best = data.best
  const closeCall = data.latest('close_call')
  // Only the head close call, and only when its two labels are the heads on screen ("201T" / "201").
  const onScreen = new Set(options.map((o) => shortHead(o.head)))
  const labelHead = (l: string) => l.trim().split(/\s+/)[0].toUpperCase()
  const headCall =
    closeCall?.part === 'head' && onScreen.has(labelHead(closeCall.a.label)) && onScreen.has(labelHead(closeCall.b.label)) ? closeCall : null
  const sel = options.find((o) => o.head === picked) ?? options[0] ?? null
  const other = options.find((o) => o.head !== sel?.head) ?? null

  const sameShaft = !data.runnerUp || !best || data.runnerUp.shaft === best.shaft
  const sub = best
    ? sameShaft
      ? `Both on ${shaftLabel(best)}. Only the head changes.`
      : `Your fit is on ${shaftLabel(best)}.`
    : null

  const aside = (
    <ResultsAside message={ASIDE_MESSAGE} chips={chipsFor(options.map((o) => o.head))}>
      {headCall && <CloseCallView part={headCall.part} a={headCall.a} b={headCall.b} tradeoff={headCall.tradeoff} next_step={headCall.next_step} />}
      {sel && <VideoTile key={sel.head} head={sel.head} />}
    </ResultsAside>
  )
  const next = <ResultsNext label="In your hands" to={{ view: 'ar' }} />

  if (!sel) {
    return (
      <>
        <p className="m-0 text-grey-a3">Your heads are on their way.</p>
        {aside}
        {next}
      </>
    )
  }

  const rowToggle = (
    <button
      type="button"
      aria-expanded={showRow}
      aria-controls="all-heads"
      onClick={() => setShowRow((v) => !v)}
      className="cursor-pointer border-0 bg-transparent p-0 text-[14px] text-grey-a3 underline transition-ui hover:text-orange-hover"
    >
      {showRow ? 'Hide the other heads' : 'Show all five heads'}
    </button>
  )

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="m-0 font-display text-[26px] font-bold uppercase max-md:text-[36px] max-md:leading-[.9] max-md:font-extrabold">
          Swap the head, keep your shaft
        </h1>
        {sub && <span className="text-[15px] text-grey-a3">{sub}</span>}
      </div>

      <div className="grid flex-[1_0_auto] grid-cols-[230px_minmax(0,1fr)] gap-4 max-md:flex-none max-md:grid-cols-1">
        <div className="contents max-md:hidden">
          <HeadStage selected={sel.head} other={other?.head ?? null} />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <FlightPanel sel={sel} other={other} guessed={guessed} />
        </div>
      </div>

      <HeadSelector options={options} selected={sel.head} onSelect={setPicked} shaft={best?.shaft} rowToggle={rowToggle} />

      {showRow && (
        <div
          ref={rowRef}
          id="all-heads"
          role="region"
          aria-label="All five heads"
          className="relative h-[260px] flex-none overflow-hidden rounded-16 border border-grey-26 bg-grey-12"
        >
          <Suspense fallback={<p className="m-0 p-4 text-[14px] text-grey-a3">Loading the heads…</p>}>
            <ClubRow
              best={best?.head ?? sel.head}
              selected={sel.head}
              onSelect={(h) => {
                if (options.some((o) => o.head === h)) setPicked(h)
              }}
            />
          </Suspense>
          <span className="pointer-events-none absolute right-3 bottom-2.5 left-3 text-[12px] text-grey-8f">
            Tap the {options.map((o) => headName(o.head)).join(' or the ')} to see it fly. Drag to turn the row.
          </span>
        </div>
      )}

      <PhoneNote text={ASIDE_MESSAGE} />
      <PhoneNext label="In your hands" to={{ view: 'ar' }} />
      {aside}
      {next}
    </>
  )
}
