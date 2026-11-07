/**
 * Browser Web Speech API only (issue #51): no keys, no backend, no extra packages.
 * TypeScript's DOM lib ships the result types but not the recognizer itself, so this declares the slice we use.
 */

export interface Recognizer {
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

/** False in browsers without speech recognition (e.g. Firefox): the mic is hidden, never shown broken. */
export const canListen = typeof Ctor === 'function'
export const canSpeak = typeof window.speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance === 'function'

export const LANGS = ['en-US', 'fi-FI'] as const
export type Lang = (typeof LANGS)[number]

export function createRecognizer(lang: Lang): Recognizer | null {
  if (!Ctor) return null
  const r = new Ctor()
  r.lang = lang
  r.interimResults = false
  r.continuous = false
  r.maxAlternatives = 1
  return r
}

/** Short, mild copy for recognizer errors (L18). */
export function errorText(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access is blocked. Allow it in the browser to talk.'
    case 'no-speech':
      return "Didn't catch anything. Tap the mic and try again."
    case 'audio-capture':
      return 'No microphone found.'
    case 'network':
      return 'Speech service unreachable. Typing works fine.'
    default:
      return 'Voice input stopped. Typing works fine.'
  }
}

/** Chat text is plain text with **bold**: strip the markers so they are not read aloud. */
export function speakable(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\s*\n+\s*/g, '. ').trim()
}

export function speak(text: string, lang: Lang) {
  if (!canSpeak) return
  const t = speakable(text)
  if (!t) return
  const u = new SpeechSynthesisUtterance(t)
  u.lang = lang
  window.speechSynthesis.speak(u)
}

export function stopSpeaking() {
  if (canSpeak) window.speechSynthesis.cancel()
}
