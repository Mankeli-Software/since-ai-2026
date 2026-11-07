import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Text } from './Text'

export interface RevealTextProps {
  text: string
  /** Animate word-by-word reveal (for live messages). Set to false to show at once. */
  animate?: boolean
  className?: string
  /** Called whenever new words are revealed, so scrolling containers can follow. */
  onReveal?: () => void
}

interface ParsedWord {
  id: number
  text: string
  bold: boolean
  punctuationAfter?: string
  spaceBefore: boolean
}

interface ParsedLine {
  lineIndex: number
  lineText: string
  words: ParsedWord[]
}

function parseLineToWords(line: string, startWordIndex: number): ParsedWord[] {
  const parts = line.split('**')
  const words: ParsedWord[] = []
  let trailingSpaceFromPrev = false
  let wordId = startWordIndex

  for (let pIdx = 0; pIdx < parts.length; pIdx++) {
    const isBold = pIdx % 2 === 1
    const text = parts[pIdx]
    if (!text) continue

    const matches = [...text.matchAll(/(\s*)(\S+)/g)]
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i]
      const hasSpace = (i === 0 && trailingSpaceFromPrev) || m[1].length > 0
      const token = m[2]

      // Glue trailing punctuation to the previous word if there was no whitespace
      if (!hasSpace && /^[.,!?:;]+$/.test(token) && words.length > 0) {
        words[words.length - 1].punctuationAfter = (words[words.length - 1].punctuationAfter || '') + token
      } else {
        words.push({
          id: wordId++,
          spaceBefore: hasSpace,
          text: token,
          bold: isBold,
        })
      }
    }
    trailingSpaceFromPrev = /\s+$/.test(text)
  }
  return words
}

function parseTextToLines(text: string): { lines: ParsedLine[]; totalWords: number } {
  const rawLines = text.split('\n')
  let currentWordId = 0
  const lines: ParsedLine[] = rawLines.map((lineText, lineIndex) => {
    const words = parseLineToWords(lineText, currentWordId)
    currentWordId += words.length
    return { lineIndex, lineText, words }
  })
  return { lines, totalWords: currentWordId }
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
  })

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [])

  return reduced
}

/**
 * Reveals assistant text word-by-word with smooth fade-in.
 * Wraps Text; respects prefers-reduced-motion and non-live message history.
 */
export function RevealText({ text, animate = true, className, onReveal }: RevealTextProps) {
  const reducedMotion = usePrefersReducedMotion()
  const shouldAnimate = Boolean(animate) && !reducedMotion

  const { lines, totalWords } = useMemo(() => parseTextToLines(text), [text])

  const [shownCount, setShownCount] = useState(() => (shouldAnimate ? 0 : totalWords))
  const shownCountRef = useRef(shownCount)
  shownCountRef.current = shownCount

  const onRevealRef = useRef(onReveal)
  onRevealRef.current = onReveal

  useEffect(() => {
    if (!shouldAnimate) {
      setShownCount(totalWords)
    }
  }, [shouldAnimate, totalWords])

  useEffect(() => {
    if (!shouldAnimate) return
    if (shownCountRef.current >= totalWords) return

    let rafId: number
    let lastTime: number | null = null
    let accum = 0

    const tick = (now: number) => {
      if (lastTime == null) {
        lastTime = now
      }
      const deltaSec = Math.min((now - lastTime) / 1000, 0.1)
      lastTime = now

      const current = shownCountRef.current
      const backlog = totalWords - current
      if (backlog <= 0) return

      // Advance at 40 words/s, accelerating when backlog is large so display never lags.
      const rate = backlog > 4 ? 40 + (backlog - 4) * 8 : 40
      accum += deltaSec * rate

      if (accum >= 1) {
        const step = Math.min(backlog, Math.floor(accum))
        accum -= step
        const next = current + step
        shownCountRef.current = next
        setShownCount(next)
        onRevealRef.current?.()
      }

      if (shownCountRef.current < totalWords) {
        rafId = requestAnimationFrame(tick)
      }
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [shouldAnimate, totalWords])

  if (!shouldAnimate) {
    return <Text text={text} />
  }

  return (
    <span className={className}>
      {lines.map((line, lIdx) => {
        const hasShownWords = line.words.some((w) => w.id < shownCount)
        const isFollowedByShown = lines.slice(lIdx + 1).some((l) => l.words.some((w) => w.id < shownCount))
        if (!hasShownWords && !isFollowedByShown) {
          return null
        }

        return (
          <Fragment key={line.lineIndex}>
            {lIdx > 0 && <br />}
            {line.words.map((w) => {
              if (w.id >= shownCount) return null
              return (
                <Fragment key={w.id}>
                  {w.spaceBefore && ' '}
                  <span className="reveal-word">
                    {w.bold ? <strong>{w.text}</strong> : w.text}
                    {w.punctuationAfter}
                  </span>
                </Fragment>
              )
            })}
          </Fragment>
        )
      })}
    </span>
  )
}
