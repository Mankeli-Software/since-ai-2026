import type { BlockOf } from '../../genui/types'
import type { ResultsData } from '../useResultsData'

export type CompareRow = BlockOf<'club_compare'>['heads'][number]

export interface HeadOption {
  head: string
  /** Where the head sits in the fit: state.best, state.runner_up, or only in the comparison. */
  rank: 'best' | 'runner' | 'other'
  /** Its club_compare row (tool output), or null when no comparison arrived. */
  row: CompareRow | null
}

const topBy = (rows: CompareRow[], skip: string | null) =>
  rows.filter((r) => r.head !== skip).reduce<CompareRow | null>((m, r) => (!m || r.score_total > m.score_total ? r : m), null)

/**
 * The two heads R3 compares. Prefer state.best vs runner_up; their numbers come from the club_compare row
 * with the same slug. If the comparison does not cover them, fall back to the comparison's own pick
 * (highlight, then the next best score), so every number shown is still from the block.
 */
export function comparePair(data: ResultsData): HeadOption[] {
  const rows = data.compare?.heads ?? []
  const best: string | null = data.best?.head ?? null
  const runner: string | null = data.runnerUp?.head && data.runnerUp.head !== best ? data.runnerUp.head : null
  const rowOf = (h: string) => rows.find((r) => r.head === h) ?? null
  const rankOf = (h: string): HeadOption['rank'] => (h === best ? 'best' : h === runner ? 'runner' : 'other')

  if (rows.length === 0) {
    return ([best, runner] as (string | null)[]).filter((h): h is string => !!h).map((head) => ({ head, rank: rankOf(head), row: null }))
  }

  const highlight: string | null = data.compare?.highlight && rowOf(data.compare.highlight) ? data.compare.highlight : null
  const primary: string | null = best && rowOf(best) ? best : (highlight ?? topBy(rows, null)?.head ?? null)
  if (!primary) return []
  const alt: string | null = runner && runner !== primary && rowOf(runner) ? runner : (topBy(rows, primary)?.head ?? null)
  return ([primary, alt] as (string | null)[]).filter((h): h is string => !!h).map((head) => ({ head, rank: rankOf(head), row: rowOf(head) }))
}

/** "201T", "201", "301" for labels and chips (the family number, no MkII / CB suffix). */
export const shortHead = (head: string) => head.split('-')[0].toUpperCase()

/** Rounded for display; the block keeps the precision. */
export const num = (n: number) => String(Math.round(n))
