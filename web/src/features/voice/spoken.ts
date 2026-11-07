/**
 * Turn what the golfer said into a card answer: option picks, numbers, "not sure".
 * Deterministic and small on purpose. Anything it can't place goes to the chat as text, where the
 * live fitter reads it and the scripted demo moves on (agent/engines/base.py `answer_of`).
 */

const YES = /\b(yes|yeah|yep|yup|sure|ok|okay|please|kylla|joo)\b/g
const NO = /\b(no|nope|nah|ei)\b/g

export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s.'+-]/gu, ' ')
    .replace(YES, 'yes')
    .replace(NO, 'no')
    .replace(/\s+/g, ' ')
    .trim()
}

export const isUnsure = (said: string) =>
  /\b(not sure|don'?t know|no idea|dunno|unsure|no clue|en tieda|en osaa sanoa)\b/.test(norm(said))

const SMALL: Record<string, number> = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
}
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }

/** "a hundred and fifty" -> "150", "one fifty" -> "150", "six foot two" -> "6 foot 2". Digits pass through. */
export function wordsToDigits(said: string): string {
  const out: string[] = []
  const words = said.toLowerCase().replace(/-/g, ' ').replace(/[,;:!?](?!\d)/g, ' ').split(/\s+/).filter(Boolean)
  let total = 0
  let cur = 0
  let run = false
  let lastSmall = false
  const flush = () => {
    if (run) out.push(String(total + cur))
    total = cur = 0
    run = lastSmall = false
  }
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (w in SMALL) {
      if (run && lastSmall) flush() // "six two": two numbers
      cur += SMALL[w]
      run = lastSmall = true
    } else if (w in TENS) {
      if (run && lastSmall && cur > 0 && cur < 10 && total === 0) cur *= 100 // "one fifty"
      else if (run && cur % 100 !== 0) flush()
      cur += TENS[w]
      run = true
      lastSmall = false
    } else if (w === 'hundred') {
      cur = (cur || 1) * 100
      run = true
      lastSmall = false
    } else if (w === 'a' && words[i + 1] === 'hundred') {
      flush()
      run = true
    } else if (w === 'and' && run && words[i + 1] && (words[i + 1] in SMALL || words[i + 1] in TENS)) {
      // "a hundred and fifty"
    } else {
      flush()
      out.push(w)
    }
  }
  flush()
  return out.join(' ')
}

/** The first number in what was said, or null. */
export function parseNumber(said: string): number | null {
  const m = /[+-]?\d+(?:[.,]\d+)?/.exec(wordsToDigits(said))
  return m ? Number(m[0].replace(',', '.')) : null
}

const ORDINAL: Record<string, number> = {
  first: 0, one: 0, '1': 0, second: 1, two: 1, '2': 1, third: 2, three: 2, '3': 2,
  fourth: 3, four: 3, '4': 3, fifth: 4, five: 4, '5': 4, sixth: 5, six: 5, '6': 5, last: -1,
}
const STOP = new Set(['the', 'a', 'an', 'i', 'im', 'my', 'it', 'its', 'and', 'or', 'of', 'to', 'for', 'in', 'on', 'with', 'is', 'go', 'one', 'please'])
const tokens = (s: string) => norm(s).split(' ').filter((t) => t.length > 1 && !STOP.has(t))

/**
 * Which option the golfer meant: by position ("the second one", "option 2"), by name, or by most
 * shared words. Null when nothing fits or two options fit equally (then the text goes to the chat).
 */
export function pickOption<T>(said: string, options: { item: T; names: (string | null | undefined)[] }[]): T | null {
  const n = norm(said)
  const pos =
    /^(?:the |option |number )?(first|second|third|fourth|fifth|sixth|last|one|two|three|four|five|six|\d)(?: one| option)?$/.exec(n) ??
    /\b(first|second|third|fourth|fifth|sixth|last)(?: one| option)\b/.exec(n) ??
    /\b(?:option|number) (one|two|three|four|five|six|\d)\b/.exec(n)
  if (pos) {
    const i = ORDINAL[pos[1]]
    const o = i === -1 ? options.at(-1) : options[i]
    if (o) return o.item
  }

  // Whole name said: the longest match wins ("regular stiff" over "stiff").
  let best: { item: T; len: number } | null = null
  let tie = false
  for (const o of options) {
    for (const name of o.names) {
      const nm = name ? norm(name) : ''
      if (!nm || !new RegExp(`(^| )${nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(n)) continue
      if (!best || nm.length > best.len) {
        tie = false
        best = { item: o.item, len: nm.length }
      } else if (nm.length === best.len && best.item !== o.item) tie = true
    }
  }
  if (best && !tie) return best.item

  // Most shared words.
  const said_ = new Set(tokens(said))
  let top: { item: T; score: number } | null = null
  tie = false
  for (const o of options) {
    const words = new Set(o.names.flatMap((nm) => (nm ? tokens(nm) : [])))
    if (words.size === 0) continue
    let hit = 0
    for (const t of words) if (said_.has(t)) hit++
    const score = hit / Math.min(words.size, 3)
    if (hit === 0) continue
    if (!top || score > top.score) {
      top = { item: o.item, score }
      tie = false
    } else if (score === top.score) tie = true
  }
  return top && !tie && top.score >= 0.34 ? top.item : null
}
