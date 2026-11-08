import type { ReactNode } from 'react'
import type { UIBlock } from '@/api/client'
import type { CameraPresetName, ClubPart } from '@/features/stage3d'
import forgeTopics from '../../../../../../fixtures/forge_topics.json'
import type { ResultsView, WhyPart } from '../../chrome'
import { whyItems, type ResultsData, type WhyItem } from '../../useResultsData'
import type { Spec } from '../../types'

/**
 * What one R2 "Why each part" screen shows (spec §6). Each parts/<part>.tsx maps the data to this:
 * the why_panel item, state.per_part, the display blocks (club_compare, flex_band) and the spec.
 *
 * Invariant 14: every number comes from that data. In the session-less fixture preview (`example`), the
 * screens show the design copy instead, labelled "Example": fixtures/ui/why_panel.json describes a
 * different golfer than the preview's best spec, so mixing the two would contradict itself.
 * A stat with no data is left out, never filled in.
 */

export type { WhyItem }
export type WhySource = NonNullable<WhyItem['sources']>[number]
type DataPart = WhyItem['part']

export interface GloveOption {
  id: string
  label: string
  sub?: string | null
}

/** The glove the golfer picked in the body_measure card, with that card's options. */
export interface GloveAnswer {
  id: string
  options: GloveOption[]
}

export interface PartCtx {
  data: ResultsData
  best: Spec
  /** The head the golfer picked in the results (#221): best, or the backend's runner-up spec. Only the head screen reads it. */
  selected: Spec
  item: WhyItem | null
  /** Fixture preview: design copy, labelled "Example". */
  example: boolean
  glove: GloveAnswer | null
}

export interface Stat {
  label: string
  value: string
  /** The key number of the screen, in orange. */
  accent?: boolean
}

export interface Callout {
  title: string
  body: string
  /** 'dark' = #121212 note (length), 'tint' = orange-tint card with a dark button (lie). */
  tone: 'dark' | 'tint'
  /** The button sends this chat turn. */
  action?: { label: string; say: string }
}

export interface Action {
  label: string
  variant: 'lightOnDark' | 'ghostOnDark'
  view: ResultsView
}

export interface PartContent {
  part: WhyPart
  /** Part name: the list eyebrow and the screen eyebrow. */
  label: string
  /** Short value for the part list. */
  listValue: string
  title: string
  provenance: { kind: 'measured' | 'chart'; text: string } | null
  reason: string
  chart: ReactNode
  stats: Stat[]
  callout: Callout | null
  actions: Action[]
  forge: { href: string; label: string; title: string } | null
  stage: {
    focus: CameraPresetName
    highlight: ClubPart | null
    /** "Focus: head". */
    label: string
    lines: [string, string]
    /** Where the callout sits, as % of the panel height. */
    at: number
    caption: string
    /** Append "Drag to rotate." when the 3D stage runs. */
    drag: boolean
  }
  aside: { message: string; chips: string[] }
  next: { label: string; to: { view: ResultsView; part?: WhyPart } }
}

// ---- data lookups ----

const DATA_PARTS: Record<WhyPart, DataPart[]> = {
  head: ['head'],
  shaft: ['flex', 'shaft_model', 'material'],
  length: ['length'],
  lie: ['lie'],
  grip: ['grip'],
}

/**
 * The why item for a UI part (the data's `flex` is the UI's shaft): the fitter's latest why_panel item first,
 * else the deterministic fit explanation (GET /fit).
 */
export function findItem(data: ResultsData, part: WhyPart): WhyItem | null {
  const items = whyItems(data)
  for (const p of DATA_PARTS[part]) {
    const hit = items.find((i) => i.part === p)
    if (hit) return hit
  }
  return null
}

/** A number from the item, or null. */
export const num = (item: WhyItem | null, ...keys: string[]): number | null => {
  for (const k of keys) {
    const v = item?.numbers?.[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return null
}

/** The close call for a part: the item's, else state.per_part's. */
export function closeCallOf(ctx: PartCtx, dataPart: DataPart) {
  const c = ctx.item?.close_call
  if (c) return { ours: c.ours, alt: c.alt ?? null, share: c.share, next_step: c.next_step ?? null }
  const p = ctx.data.state?.per_part?.[dataPart]
  if (p?.close_call) return { ours: p.ours ?? null, alt: p.alt ?? null, share: p.share, next_step: p.next_step ?? null }
  return null
}

export const latestBlock = <T extends UIBlock['type']>(ctx: PartCtx, type: T) => ctx.data.latest(type)

// ---- formatting ----

/** At most `digits` decimals, no trailing zeros. */
export function fmt(n: number, digits = 1) {
  const f = 10 ** digits
  return String(Math.round(n * f) / f)
}

/** "+0.25 in", "−0.5 in" (true minus sign). */
export const signedIn = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n), 2)} in`

/** "201T MkII" -> "201T"; "301 CB" stays. */
export const shortHead = (name: string) => name.replace(/\s+MkII$/i, '')

export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

// ---- provenance ----

const MEASURED = new Set<WhySource['source']>(['trackman', 'radar', 'photo', 'video', 'ball_line', 'vision'])
const SOURCE_WORDS: Record<WhySource['source'], string> = {
  questionnaire: 'your answers',
  photo: 'a photo',
  video: 'a video',
  trackman: 'your TrackMan shots',
  radar: 'your radar shots',
  ball_line: 'the ball-line test',
  vision: 'a photo',
  derived: 'a fitting chart',
}

const joinAnd = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)

/**
 * Solid dot = measured (shots, or something the golfer measured); hollow ring = from the chart.
 * The line reads the sources' notes: "From 24 TrackMan shots", "From your shots and what you want".
 */
export function provenanceOf(sources: WhySource[] | undefined): PartContent['provenance'] {
  if (!sources?.length) return null
  const measured = sources.some(
    (s) => MEASURED.has(s.source) || (s.source === 'questionnaire' && !/guess|not sure|default/i.test(s.note ?? '')),
  )
  const words = [...new Set(sources.map((s) => (s.note?.trim() || SOURCE_WORDS[s.source]).replace(/\.$/, '')))]
  return { kind: measured ? 'measured' : 'chart', text: `From ${joinAnd(words)}` }
}

/** What a part is "Based on", for the stat tile. */
export function basedOn(sources: WhySource[] | undefined): string | null {
  if (!sources?.length) return null
  if (sources.some((s) => MEASURED.has(s.source))) return 'Shots'
  if (sources.every((s) => s.source === 'derived')) return 'Chart'
  return 'Your answers'
}

// ---- Forge ----

const FORGE = forgeTopics as Record<string, { title: string; blurb: string; url?: string }>
/** The Forge clinic origin (docs/PRODUCT_VIDEOS.md §4). forge_topics.json has no per-topic URLs yet. */
const FORGE_CLINIC_URL = 'https://forge.takomogolf.com/clinic'

/** "Go deeper in The Forge: {label}", only for a topic id that exists in fixtures/forge_topics.json. */
export function forgeLink(topic: string, label: string): PartContent['forge'] {
  const t = FORGE[topic]
  if (!t) return null
  return { href: t.url ?? FORGE_CLINIC_URL, label: `Go deeper in The Forge: ${label}`, title: t.blurb }
}

/** Shown when a live run has not explained this part (no item): no numbers, no claims. */
export const NOT_EXPLAINED = "I haven't walked you through this part yet. Ask me and I'll explain it."
