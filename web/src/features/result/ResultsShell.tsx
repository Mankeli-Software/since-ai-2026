import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StudioHeader } from '../studio-shell/StudioHeader'
import { BuyBar } from './BuyBar'
import {
  ResultsChromeContext,
  ResultsSlotsContext,
  readPartFromUrl,
  readViewFromUrl,
  urlFor,
  type ResultsChrome,
  type ResultsSlots,
  type ResultsView,
  type WhyPart,
} from './chrome'
import { DetailNav } from './DetailNav'
import { AsideDefaults, FitterAside } from './FitterAside'
import { R1Summary } from './R1Summary'
import { R2Why } from './R2Why'
import { R3Compare } from './R3Compare'
import { R4AR } from './R4AR'
import { R5Stock } from './R5Stock'
import { flexName, headName, stifferFlex } from './specLabel'
import type { Spec } from './types'
import { isFixtureFlag, seedFixtureHeader, useResultsData, type ResultsData } from './useResultsData'

/**
 * v3 results phase (spec §2.2): header "Your fit", then a body row of
 *   left column = DetailNav (not on the summary) + scrolling <main> (the view) + the always-visible BuyBar
 *   right       = the 380px "Your fitter" aside (full height, own composer).
 * The view lives in ?view=summary|why|compare|ar|stock and R2's part in ?part= (history.replaceState).
 * Views talk to the chrome through useResultsChrome / ResultsNext / ResultsAside (see chrome.tsx).
 *
 * `fixture` renders the fixture preview without a session (dev.html?ff=results); studio.html uses
 * `?ff=v3,results-fixture` for the same thing.
 */

const SUMMARY_FALLBACK = "Here's your build. The TL;DR is right above, and every number is open for inspection below."
const DETAIL_FALLBACK = "All the raw numbers and specs are right here. Ask me anything—or poke holes in what looks off."

/** Default suggestion chips (spec R1), built from the fit so they never ask about the wrong flex or head. */
function defaultChips(data: ResultsData): string[] {
  const chips: string[] = []
  const best = data.best
  const stiffer = best ? stifferFlex(best.flex) : null
  if (best && stiffer) chips.push(`Why ${flexName(best.flex).toLowerCase()}, not ${flexName(stiffer).toLowerCase()}?`)
  if (data.runnerUp && data.runnerUp.head !== best?.head) chips.push(`Is the ${headName(data.runnerUp.head)} better for me?`)
  chips.push('How does it sound?')
  return chips
}

function View({ view }: { view: ResultsView }) {
  switch (view) {
    case 'summary':
      return <R1Summary />
    case 'why':
      return <R2Why />
    case 'compare':
      return <R3Compare />
    case 'ar':
      return <R4AR />
    case 'stock':
      return <R5Stock />
  }
}

export default function ResultsShell({ fixture = false }: { fixture?: boolean }) {
  const data = useResultsData(fixture)
  const [view, setView] = useState<ResultsView>(readViewFromUrl)
  const [part, setPartState] = useState<WhyPart>(() => readPartFromUrl() ?? 'head')
  const [buySpec, setBuySpec] = useState<Spec | null>(null)
  const [nextEl, setNextEl] = useState<HTMLElement | null>(null)
  const [asideEl, setAsideEl] = useState<HTMLElement | null>(null)
  const [asideOverrides, setAsideOverrides] = useState(0)
  const mainRef = useRef<HTMLElement>(null)

  // Fixture preview: give the shared header a confidence to show (only when no session exists).
  useEffect(() => {
    if (fixture || isFixtureFlag()) seedFixtureHeader()
  }, [fixture])

  const hrefFor = useCallback((v: ResultsView, p?: WhyPart) => urlFor(v, p ?? (v === 'why' ? part : null)), [part])

  const go = useCallback(
    (v: ResultsView, p?: WhyPart) => {
      if (p) setPartState(p)
      setView(v)
      history.replaceState(history.state, '', urlFor(v, p ?? (v === 'why' ? part : null)))
      mainRef.current?.scrollTo({ top: 0 })
    },
    [part],
  )

  const setPart = useCallback(
    (p: WhyPart) => {
      setPartState(p)
      history.replaceState(history.state, '', urlFor(view, p))
      mainRef.current?.scrollTo({ top: 0 })
    },
    [view],
  )

  const chrome = useMemo<ResultsChrome>(
    () => ({ view, part, go, setPart, hrefFor, data, setBuySpec, buySpec }),
    [view, part, go, setPart, hrefFor, data, buySpec],
  )

  const registerAside = useCallback(() => {
    setAsideOverrides((n) => n + 1)
    return () => setAsideOverrides((n) => n - 1)
  }, [])
  const slots = useMemo<ResultsSlots>(() => ({ nextEl, asideEl, registerAside }), [nextEl, asideEl, registerAside])

  const asideDefaults = useMemo(
    () => ({ assistantText: data.assistantText, fallback: view === 'summary' ? SUMMARY_FALLBACK : DETAIL_FALLBACK }),
    [data.assistantText, view],
  )
  const chips = useMemo(() => defaultChips(data), [data])

  return (
    <ResultsChromeContext.Provider value={chrome}>
      <ResultsSlotsContext.Provider value={slots}>
        <AsideDefaults.Provider value={asideDefaults}>
          <div className="bg-bay flex h-screen flex-col overflow-hidden">
            <StudioHeader variant="results" />
            <div className="flex min-h-0 flex-1">
              <div className="flex min-w-0 flex-1 flex-col">
                {view !== 'summary' && <DetailNav view={view} head={data.best?.head ?? null} />}
                <main ref={mainRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-10 py-[18px]">
                  <View view={view} />
                </main>
                <BuyBar spec={buySpec ?? data.best} nextRef={setNextEl} />
              </div>
              <FitterAside chips={chips} slotRef={setAsideEl} overridden={asideOverrides > 0} />
            </div>
          </div>
        </AsideDefaults.Provider>
      </ResultsSlotsContext.Provider>
    </ResultsChromeContext.Provider>
  )
}
