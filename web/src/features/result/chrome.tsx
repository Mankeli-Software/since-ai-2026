import { createContext, useContext, useEffect, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { UIBlock } from '@/api/client'
import type { SpecPart } from '@/components/studio'
import { AsideBody } from './FitterAside'
import type { ResultsData } from './useResultsData'
import type { Spec } from './types'

/**
 * Results chrome API (spec §2.2) for the views inside ResultsShell (R1 here; R2–R5 in T4a/T4b).
 *
 *   const { view, part, go, setPart, hrefFor, data, setBuySpec } = useResultsChrome()
 *     view: ResultsView            current tab, mirrored to ?view= (summary has no param)
 *     part: WhyPart                R2 part, mirrored to ?part= (default 'head'; kept only on the why view)
 *     go(view, part?)              switch view (scrolls main to top); part is optional
 *     setPart(part)                switch the R2 part without leaving the view
 *     hrefFor(view, part?)         deep-link href for an <a> (keeps engine/demo/ff params)
 *     data: ResultsData            live store data or the fixture preview (see useResultsData)
 *     setBuySpec(spec | null)      R5: the buy bar follows this spec instead of `selected` (null = back to it)
 *     buySpec: Spec | null         the spec set with setBuySpec (null = the buy bar shows `selected`)
 *     selectedHead: string | null  the head the golfer picked (null = data.best, the default until they pick)
 *     selectHead(head)             pick a head (best or runner-up); every view, the buy bar and the QR follow it
 *     selected: Spec | null        data.best or data.runnerUp, whichever is picked (full backend specs, never rebuilt)
 *     other: Spec | null           the one of the two that is not picked (null when there is no distinct runner-up)
 *
 *   <ResultsNext label="Shaft" to={{ view: 'why', part: 'shaft' }} />    buy bar "Next: Shaft →"
 *   <ResultsNext label="Compare heads" to={{ view: 'compare' }} />
 *   <ResultsNext label="…" onClick={() => …} />                             or any handler
 *     Render it inside the view; it portals into the buy bar and disappears when the view unmounts.
 *
 *   <ResultsAside message="…" chips={['What would stiff do?']} block={closeCallBlock}>
 *     {optional extra slot content, e.g. a video tile}
 *   </ResultsAside>
 *     Replaces the aside body (message, embedded slot, chips) while mounted. `message` omitted = the
 *     fitter's latest message (or `fallback`). `block` renders through GenUiBlock (close_call,
 *     product_video, simulator_map, …) after the children. Chips call say(text). Header and composer stay.
 *
 *   <ViewLink view="compare">…</ViewLink>   an <a> that deep-links and switches view in place.
 */

export type ResultsView = 'summary' | 'why' | 'compare' | 'ar' | 'stock'
export type WhyPart = SpecPart

export const RESULTS_VIEWS: readonly ResultsView[] = ['summary', 'why', 'compare', 'ar', 'stock']
export const WHY_PARTS: readonly WhyPart[] = ['head', 'shaft', 'length', 'lie', 'grip']

export interface ResultsChrome {
  view: ResultsView
  part: WhyPart
  go(view: ResultsView, part?: WhyPart): void
  setPart(part: WhyPart): void
  hrefFor(view: ResultsView, part?: WhyPart): string
  data: ResultsData
  setBuySpec(spec: Spec | null): void
  /** What setBuySpec last set (null = the buy bar follows `selected`). Lets R5 show the current choice on return. */
  buySpec: Spec | null
  /** The picked head slug; null = data.best (the default until the golfer picks). */
  selectedHead: string | null
  /** Pick the best or the runner-up head for the whole results flow (clears an R5 buySpec for the old head). */
  selectHead(head: string): void
  /** data.best or data.runnerUp, whichever head is picked. Both are full backend specs. */
  selected: Spec | null
  /** The other of the two (null when there is no distinct runner-up). */
  other: Spec | null
}

/** Portal targets owned by the shell. Internal: views use ResultsNext / ResultsAside. */
export interface ResultsSlots {
  nextEl: HTMLElement | null
  asideEl: HTMLElement | null
  /** Marks the aside as overridden while a ResultsAside is mounted; returns the cleanup. */
  registerAside(): () => void
}

export const ResultsChromeContext = createContext<ResultsChrome | null>(null)
export const ResultsSlotsContext = createContext<ResultsSlots | null>(null)

export function useResultsChrome(): ResultsChrome {
  const c = useContext(ResultsChromeContext)
  if (!c) throw new Error('useResultsChrome must be used inside ResultsShell')
  return c
}

// ---- URL helpers (?view= and ?part=, history.replaceState) ----

export function readViewFromUrl(): ResultsView {
  const v = new URLSearchParams(location.search).get('view')
  return RESULTS_VIEWS.includes(v as ResultsView) ? (v as ResultsView) : 'summary'
}

export function readPartFromUrl(): WhyPart | null {
  const p = new URLSearchParams(location.search).get('part')
  return WHY_PARTS.includes(p as WhyPart) ? (p as WhyPart) : null
}

export function urlFor(view: ResultsView, part?: WhyPart | null) {
  const q = new URLSearchParams(location.search)
  if (view === 'summary') q.delete('view')
  else q.set('view', view)
  if (part) q.set('part', part)
  else q.delete('part')
  const s = q.toString()
  return `${location.pathname}${s ? `?${s}` : ''}${location.hash}`
}

const plainClick = (e: MouseEvent) => !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)

// ---- declarative pieces for views ----

export interface ViewLinkProps {
  view: ResultsView
  part?: WhyPart
  className?: string
  children: ReactNode
  'aria-current'?: 'page'
  'aria-label'?: string
}

/** An <a> with a real deep link that switches the view in place on a plain click. */
export function ViewLink({ view, part, className, children, ...aria }: ViewLinkProps) {
  const { go, hrefFor } = useResultsChrome()
  return (
    <a
      href={hrefFor(view, part)}
      onClick={(e) => {
        if (!plainClick(e)) return
        e.preventDefault()
        go(view, part)
      }}
      className={className}
      {...aria}
    >
      {children}
    </a>
  )
}

export interface ResultsNextProps {
  /** Shown as "Next: {label} →". */
  label: string
  /** Where it goes (renders a deep link). */
  to?: { view: ResultsView; part?: WhyPart }
  /** Or a handler (runs after `to`, if both are given). */
  onClick?: () => void
}

export const nextLinkCls =
  'mr-2 whitespace-nowrap font-display text-[16px] font-bold uppercase tracking-[0.04em] text-orange-hover no-underline transition-ui hover:text-washed-white'

/** The buy bar's optional "Next: … →" link. Portals into the buy bar while mounted. */
export function ResultsNext({ label, to, onClick }: ResultsNextProps) {
  const slots = useContext(ResultsSlotsContext)
  const chrome = useContext(ResultsChromeContext)
  if (!slots?.nextEl || !chrome) return null
  return createPortal(
    <a
      href={to ? chrome.hrefFor(to.view, to.part) : '#'}
      onClick={(e) => {
        if (to && !plainClick(e)) return
        e.preventDefault()
        if (to) chrome.go(to.view, to.part)
        onClick?.()
      }}
      className={nextLinkCls}
    >
      Next: {label} →
    </a>,
    slots.nextEl,
  )
}

export interface ResultsAsideProps {
  /** Override message (plain text, **bold** allowed). Omitted = the fitter's latest message, else `fallback`. */
  message?: string
  /** Used when there is no override and no fitter message yet. */
  fallback?: string
  /** Suggested questions; each calls say(text). */
  chips?: string[]
  /** A gen-UI block to embed (close_call, product_video, simulator_map, …), rendered after the children. */
  block?: UIBlock | null
  /** Extra embedded content (a light card, a video tile, the R1b confirm section). */
  children?: ReactNode
}

/** Replaces the "Your fitter" aside body (message, slot, chips) while mounted. */
export function ResultsAside(props: ResultsAsideProps) {
  const slots = useContext(ResultsSlotsContext)
  const register = slots?.registerAside
  useEffect(() => register?.(), [register])
  if (!slots?.asideEl) return null
  return createPortal(<AsideBody {...props} />, slots.asideEl)
}

/** Visible label for example (non-tool) data, L14. */
export function ExamplePill({ title = 'Example data, not from Takomo' }: { title?: string }) {
  return (
    <span title={title} className="rounded-4 border border-page-line-2 px-1.5 py-px font-display text-[11px] font-semibold tracking-[0.16em] text-on-page-3 uppercase">
      Example
    </span>
  )
}

