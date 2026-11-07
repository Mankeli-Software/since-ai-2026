import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { api } from '@/api/client'
import { Eyebrow, StatTile } from '@/components/studio'
import { FlightSvg, flightTwoHeads, type FlightResult, type HeadFlight } from '../flight'
import { ResultsAside, ResultsNext, useResultsChrome } from './chrome'
import { HeadSelector } from './compare/HeadSelector'
import { HeadStage } from './compare/HeadStage'
import { comparePair, shortHead, type CompareRow, type HeadOption } from './compare/pair'
import { VideoTile } from './compare/VideoTile'
import { PhoneNext, PhoneNote } from './PhoneBits'
import { headName, shaftLabel } from './specLabel'
import { CloseCallView } from './views/CloseCallView'
import { useSession } from '@/store/session'

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

function CompareTiles({
  selFlight,
  otherFlight,
  selFallback,
  otherFallback,
}: {
  selFlight: HeadFlight | null
  otherFlight: HeadFlight | null
  selFallback: CompareRow | null
  otherFallback: CompareRow | null
}) {
  const selCarry = selFlight ? Math.round(selFlight.summary.carry.mean) : selFallback ? Math.round(selFallback.carry) : null
  const otherCarry = otherFlight ? Math.round(otherFlight.summary.carry.mean) : otherFallback ? Math.round(otherFallback.carry) : undefined

  const selApex = selFlight ? Math.round(selFlight.summary.apex) : selFallback ? Math.round(selFallback.apex) : null
  const otherApex = otherFlight ? Math.round(otherFlight.summary.apex) : otherFallback ? Math.round(otherFallback.apex) : undefined

  const selLand = selFlight ? (selFlight.summary.land_angle != null ? Math.round(selFlight.summary.land_angle) : null) : selFallback ? Math.round(selFallback.land_angle) : null
  const otherLand = otherFlight ? (otherFlight.summary.land_angle != null ? Math.round(otherFlight.summary.land_angle) : undefined) : otherFallback ? Math.round(otherFallback.land_angle) : undefined

  const selSpread = selFlight ? (selFlight.summary.side?.sd != null ? Math.round(selFlight.summary.side.sd) : null) : selFallback ? Math.round(selFallback.side_sd) : null
  const otherSpread = otherFlight ? (otherFlight.summary.side?.sd != null ? Math.round(otherFlight.summary.side.sd) : undefined) : otherFallback ? Math.round(otherFallback.side_sd) : undefined

  return (
    <div className="grid grid-cols-4 gap-2.5 max-md:grid-cols-2">
      <StatTile tone="dark" label="Carry" value={selCarry !== null ? String(selCarry) : '—'} compare={otherCarry !== undefined ? String(otherCarry) : undefined} unit="yd" />
      <StatTile tone="dark" label="Apex" value={selApex !== null ? String(selApex) : '—'} compare={otherApex !== undefined ? String(otherApex) : undefined} unit="yd" />
      <StatTile tone="dark" label="Landing" value={selLand !== null ? `${selLand}°` : '—'} compare={otherLand !== undefined ? `${otherLand}°` : undefined} />
      <StatTile tone="dark" label="Side spread" value={selSpread !== null ? `±${selSpread}` : '—'} compare={otherSpread !== undefined ? `±${otherSpread}` : undefined} unit="yd" />
    </div>
  )
}

function FlightPanel({
  sel,
  other,
  guessed,
  flightResult,
}: {
  sel: HeadOption
  other: HeadOption | null
  guessed: boolean
  flightResult: FlightResult | null
}) {
  const activeFlight = flightResult ?? flightTwoHeads
  const selFlight = activeFlight.per_head.find((h) => h.head === sel.head) ?? null
  const otherFlight = activeFlight.per_head.find((h) => h.head === other?.head) ?? null

  const headsOnScreen = new Set([sel.head, other?.head].filter(Boolean))
  const displayData: FlightResult = {
    own_shots: activeFlight.own_shots ?? [],
    per_head: activeFlight.per_head.filter((h) => headsOnScreen.has(h.head)),
  }

  const hasOwnShots = (displayData.own_shots?.length ?? 0) > 0
  const title = hasOwnShots ? `Your shots vs the ${shortHead(sel.head)}` : 'Your swing, dispersion'

  return (
    <>
      <div className="rounded-16 border border-grey-26 bg-grey-12 px-[18px] pt-3 pb-1 max-md:px-3.5">
        <div className="flex items-baseline justify-between gap-4 max-md:flex-wrap max-md:gap-x-3 max-md:gap-y-0.5">
          <Eyebrow className="text-grey-a3">{title}</Eyebrow>
          <span
            title={guessed ? 'Dashed: your carry is a guess. Import shots to measure it.' : "Estimated by Takomo's physics model"}
            className="text-[12px] text-grey-8f"
          >
            Estimated by Takomo's physics model, yards
          </span>
        </div>
        <FlightSvg
          className="block w-full"
          data={displayData}
          recommendedSlug={sel.head}
          view="top"
          guessed={guessed}
          caption="Estimated by Takomo's physics model, yards"
        />
      </div>
      <CompareTiles
        selFlight={selFlight}
        otherFlight={otherFlight}
        selFallback={sel.row}
        otherFallback={other?.row ?? null}
      />
    </>
  )
}

/**
 * R3 "Compare heads, see it fly" (V3-R3-Compare): same shaft, two heads, the selected one's flight in orange.
 * Phones (M-R3): one column, no head photo panel, the fitter's note inline and a Next card at the bottom.
 */
export function R3Compare() {
  const { data } = useResultsChrome()
  const sessionId = useSession((s) => s.sessionId)
  const guessed = (data.state?.shots ?? []).length === 0
  const options = comparePair(data)
  const [picked, setPicked] = useState<string | null>(null)
  const [showRow, setShowRow] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)

  const [flightResult, setFlightResult] = useState<FlightResult | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setFlightResult(flightTwoHeads)
      return
    }
    let cancelled = false
    api
      .POST('/api/flight', {
        body: {
          session_id: sessionId,
          heads: undefined,
        },
      })
      .then((res) => {
        if (!cancelled && res.data) {
          setFlightResult(res.data as FlightResult)
        }
      })
      .catch((err) => {
        console.warn('Flight simulation request failed', err)
      })

    return () => {
      cancelled = true
    }
  }, [sessionId, data.state?.evidence_version])

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
        <div className="flex flex-col gap-1.5 max-md:hidden">
          <HeadStage selected={sel.head} other={other?.head ?? null} />
          <span className="text-center text-[11px] text-grey-8f">Illustrative 3D model</span>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <FlightPanel sel={sel} other={other} guessed={guessed} flightResult={flightResult} />
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
          <div className="pointer-events-none absolute right-3 bottom-2.5 left-3 flex items-center justify-between text-[12px] text-grey-8f">
            <span>Tap the {options.map((o) => headName(o.head)).join(' or the ')} to see it fly. Drag to turn the row.</span>
            <span>Illustrative 3D model</span>
          </div>
        </div>
      )}

      <PhoneNote text={ASIDE_MESSAGE} />
      <PhoneNext label="In your hands" to={{ view: 'ar' }} />
      {aside}
      {next}
    </>
  )
}
