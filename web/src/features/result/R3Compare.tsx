import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { Eyebrow, StatTile } from '@/components/studio'
import { distanceValue, unitLabel } from '@/lib/units'
import { useUnitsStore } from '@/store/units'
import { FlightCompare, flightTwoHeads, type FlightCompareArc, type FlightResult, type HeadFlight } from '../flight'
import { ResultsAside, ResultsNext, useResultsChrome } from './chrome'
import { HeadSelector } from './compare/HeadSelector'
import { comparePair, shortHead, type CompareRow, type HeadOption } from './compare/pair'
import { VideoTile } from './compare/VideoTile'
import { PhoneNext, PhoneNote } from './PhoneBits'
import { shaftLabel } from './specLabel'
import { CloseCallView } from './views/CloseCallView'
import { useSession } from '@/store/session'

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
  const units = useUnitsStore((s) => s.units)
  const dUnit = unitLabel('distance', units)

  const selCarry = selFlight ? distanceValue(selFlight.summary.carry.mean, units) : selFallback ? distanceValue(selFallback.carry, units) : null
  const otherCarry = otherFlight ? distanceValue(otherFlight.summary.carry.mean, units) : otherFallback ? distanceValue(otherFallback.carry, units) : undefined

  const selApex = selFlight ? distanceValue(selFlight.summary.apex, units) : selFallback ? distanceValue(selFallback.apex, units) : null
  const otherApex = otherFlight ? distanceValue(otherFlight.summary.apex, units) : otherFallback ? distanceValue(otherFallback.apex, units) : undefined

  const selLand = selFlight ? (selFlight.summary.land_angle != null ? Math.round(selFlight.summary.land_angle) : null) : selFallback ? Math.round(selFallback.land_angle) : null
  const otherLand = otherFlight ? (otherFlight.summary.land_angle != null ? Math.round(otherFlight.summary.land_angle) : undefined) : otherFallback ? Math.round(otherFallback.land_angle) : undefined

  const selSpread = selFlight ? (selFlight.summary.side?.sd != null ? distanceValue(selFlight.summary.side.sd, units) : null) : selFallback ? distanceValue(selFallback.side_sd, units) : null
  const otherSpread = otherFlight ? (otherFlight.summary.side?.sd != null ? distanceValue(otherFlight.summary.side.sd, units) : undefined) : otherFallback ? distanceValue(otherFallback.side_sd, units) : undefined

  return (
    <div className="grid grid-cols-4 gap-2.5 max-md:grid-cols-2">
      <StatTile tone="dark" label="Carry" value={selCarry !== null ? String(selCarry) : '—'} compare={otherCarry !== undefined ? String(otherCarry) : undefined} unit={dUnit} />
      <StatTile tone="dark" label="Apex" value={selApex !== null ? String(selApex) : '—'} compare={otherApex !== undefined ? String(otherApex) : undefined} unit={dUnit} />
      <StatTile tone="dark" label="Landing" value={selLand !== null ? `${selLand}°` : '—'} compare={otherLand !== undefined ? `${otherLand}°` : undefined} />
      <StatTile tone="dark" label="Side spread" value={selSpread !== null ? `±${selSpread}` : '—'} compare={otherSpread !== undefined ? `±${otherSpread}` : undefined} unit={dUnit} />
    </div>
  )
}

/**
 * One side-view arc per head, from the flight API (carry mean, apex, landing angle) or, when that head has no
 * flight, its club_compare row. FlightCompare labels and scales in metres, so yards are converted for drawing.
 */
function arcFor(o: HeadOption | null, flight: HeadFlight | null): FlightCompareArc | null {
  if (!o) return null
  const src =
    flight && flight.summary.land_angle != null
      ? { carry: flight.summary.carry.mean, apex: flight.summary.apex, land: flight.summary.land_angle }
      : o.row
        ? { carry: o.row.carry, apex: o.row.apex, land: o.row.land_angle }
        : null
  if (!src) return null
  return {
    id: o.head,
    label: shortHead(o.head),
    carry: distanceValue(src.carry, 'metric', 1),
    apex: distanceValue(src.apex, 'metric', 1),
    land_angle: src.land,
  }
}

const describeArc = (a: FlightCompareArc) =>
  `${a.label} carries ${Math.round(a.carry)} metres, apex ${Math.round(a.apex)}, lands at ${Math.round(a.land_angle)} degrees.`

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

  const arcs = [arcFor(sel, selFlight), arcFor(other, otherFlight)].filter((a): a is FlightCompareArc => !!a)
  const estCaption = "Estimated by Takomo's physics model, meters"

  return (
    <>
      <div className="rounded-16 border border-grey-26 bg-grey-12 px-[18px] pt-3 pb-1 max-md:px-3.5">
        <div className="flex items-baseline justify-between gap-4 max-md:flex-wrap max-md:gap-x-3 max-md:gap-y-0.5">
          <Eyebrow className="text-grey-a3">Your swing, side view</Eyebrow>
          <span
            title={guessed ? 'Dashed: your carry is a guess. Import shots to measure it.' : "Estimated by Takomo's physics model"}
            className="text-[12px] text-grey-8f"
          >
            {estCaption}
          </span>
        </div>
        {arcs.length > 0 ? (
          <FlightCompare
            className="block w-full"
            arcs={arcs}
            selected={sel.head}
            guessed={guessed}
            ariaLabel={`${arcs.map(describeArc).join(' ')} ${estCaption}.`}
          />
        ) : (
          <p className="m-0 py-6 text-[14px] text-grey-a3">The flight is on its way.</p>
        )}
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
        <p className="m-0 text-on-page-2">Your heads are on their way.</p>
        {aside}
        {next}
      </>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="m-0 font-display text-[26px] font-bold uppercase max-md:text-[36px] max-md:leading-[.9] max-md:font-extrabold">
          Swap the head, keep your shaft
        </h1>
        {sub && <span className="text-[15px] text-on-page-2">{sub}</span>}
      </div>

      <div data-surface="dark" className="flex min-w-0 flex-[1_0_auto] flex-col gap-3 max-md:flex-none">
        <FlightPanel sel={sel} other={other} guessed={guessed} flightResult={flightResult} />
      </div>

      <HeadSelector options={options} selected={sel.head} onSelect={setPicked} shaft={best?.shaft} />

      <PhoneNote text={ASIDE_MESSAGE} />
      <PhoneNext label="In your hands" to={{ view: 'ar' }} />
      {aside}
      {next}
    </>
  )
}
