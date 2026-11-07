/**
 * Browser speech-to-text (Web Speech API) for the voice conversation (#51). Speech-to-text stays in the
 * browser: no key, no upload, interim words show while the golfer talks. The fitter's voice is ElevenLabs
 * (speaker.ts), with the browser's own voice as the fallback.
 * TypeScript's DOM lib ships the result types but not the recognizer, so this declares the slice we use.
 */

interface Recognizer {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  onresult: ((ev: { resultIndex: number; results: SpeechRecognitionResultList }) => void) | null
  onerror: ((ev: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognizerCtor = new () => Recognizer

const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor }
const Ctor: RecognizerCtor | undefined = w.SpeechRecognition ?? w.webkitSpeechRecognition

/** False in browsers without speech recognition (e.g. Firefox): "Say it" stays disabled, never broken. */
export const canListen = typeof Ctor === 'function'
export const canSpeak = typeof window.speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance === 'function'

export const LANGS = ['en-US', 'fi-FI'] as const
export type Lang = (typeof LANGS)[number]

export interface ListenHandlers {
  /** Words so far, while the golfer is still talking. */
  onInterim(text: string): void
  /** The whole utterance, once they pause. */
  onFinal(text: string): void
  onError(code: string): void
  /** Always called last, after a final result, an error or `stop()`. */
  onEnd(): void
}

/** Listen for one utterance. Returns a stop function (`abort` drops what was heard). */
export function listenOnce(lang: Lang, h: ListenHandlers): ((abort?: boolean) => void) | null {
  if (!Ctor) return null
  const r = new Ctor()
  r.lang = lang
  r.interimResults = true
  r.continuous = false
  r.maxAlternatives = 1
  let final = ''
  r.onresult = (ev) => {
    let interim = ''
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const t = ev.results[i][0].transcript
      if (ev.results[i].isFinal) final += t
      else interim += t
    }
    h.onInterim((final + interim).trim())
  }
  r.onerror = (ev) => {
    if (ev.error !== 'aborted') h.onError(ev.error)
  }
  r.onend = () => {
    const t = final.trim()
    if (t) h.onFinal(t)
    h.onEnd()
  }
  try {
    r.start()
  } catch {
    h.onError('start')
    h.onEnd()
    return null
  }
  return (abort) => {
    if (abort) {
      final = ''
      r.abort()
    } else r.stop()
  }
}

/** Short, mild copy for recognizer errors (L18). */
export function errorText(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access is blocked. Allow it in the browser to talk.'
    case 'no-speech':
      return "Didn't catch that."
    case 'audio-capture':
      return 'No microphone found.'
    case 'network':
      return 'Speech service unreachable. Typing works fine.'
    default:
      return 'Voice stopped. Typing works fine.'
  }
}

/** Chat text is plain text with **bold**. Make it sound right when read aloud. */
export function speakable(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/([+\-−]?)(\d+(?:\.\d+)?)\s*°/g, (_, s: string, n: string) => `${s === '+' ? 'plus ' : s ? 'minus ' : ''}${n} degrees`)
    .replace(/(\d)\s*yd\b/g, '$1 yards')
    .replace(/(\d)\s*mph\b/g, '$1 miles per hour')
    .replace(/(\d)\s*mm\b/g, '$1 millimetres')
    .replace(/\bMKII\b/g, 'Mark Two')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
