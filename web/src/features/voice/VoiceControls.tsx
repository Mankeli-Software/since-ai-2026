import { useEffect, useRef, useState } from 'react'
import { Mic, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { hasFlag } from '@/lib/flags'
import { useSession } from '@/store/session'
import { canListen, canSpeak, createRecognizer, errorText, LANGS, speak, stopSpeaking, type Lang, type Recognizer } from './speech'

interface Props {
  /** The final transcript. The chat puts it in the input, so the golfer can edit it and send it like typed text. */
  onTranscript(text: string): void
  disabled?: boolean
}

/**
 * Voice input + optional spoken replies (issue #51), Web Speech API only. Behind `?ff=voice`.
 * Renders nothing without the flag or without browser support, so the chat stays unchanged.
 */
export function VoiceControls(props: Props) {
  if (!hasFlag('voice') || (!canListen && !canSpeak)) return null
  return <VoiceControlsInner {...props} />
}

function VoiceControlsInner({ onTranscript, disabled }: Props) {
  const [lang, setLang] = useState<Lang>('en-US')
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [speakOn, setSpeakOn] = useState(false)
  const recRef = useRef<Recognizer | null>(null)
  const onTranscriptRef = useRef(onTranscript)
  useEffect(() => { onTranscriptRef.current = onTranscript }, [onTranscript])

  const messages = useSession((s) => s.messages)
  const busy = useSession((s) => s.busy)
  const spoken = useRef(new Set<string>())

  // Spoken replies: read each finished assistant message once, after the turn ends (text streams in deltas).
  useEffect(() => {
    if (!speakOn || busy) return
    for (const m of messages) {
      if (m.role !== 'assistant' || spoken.current.has(m.id)) continue
      spoken.current.add(m.id)
      speak(m.text, lang)
    }
  }, [speakOn, busy, messages, lang])

  // Hide the error bubble after a moment.
  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 4000)
    return () => clearTimeout(t)
  }, [error])

  // Stop listening and talking when the chat goes away.
  useEffect(() => () => { recRef.current?.abort(); stopSpeaking() }, [])

  const toggleListen = () => {
    if (listening) {
      recRef.current?.stop()
      return
    }
    const r = createRecognizer(lang)
    if (!r) return
    stopSpeaking() // don't transcribe our own voice
    setError(null)
    r.onresult = (ev) => {
      let text = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) text += ev.results[i][0].transcript
      }
      text = text.trim()
      if (text) onTranscriptRef.current(text)
    }
    r.onerror = (ev) => {
      if (ev.error !== 'aborted') setError(errorText(ev.error))
    }
    r.onend = () => {
      setListening(false)
      recRef.current = null
    }
    recRef.current = r
    try {
      r.start()
      setListening(true)
    } catch {
      recRef.current = null
      setError(errorText('start'))
    }
  }

  const toggleSpeak = () => {
    if (speakOn) {
      stopSpeaking()
      setSpeakOn(false)
      return
    }
    // Only replies from now on: never read the whole history aloud.
    for (const m of messages) spoken.current.add(m.id)
    setSpeakOn(true)
  }

  const nextLang = LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]

  return (
    <div className="relative flex shrink-0 items-center gap-1">
      {canListen && (
        <Button
          type="button"
          size="icon"
          variant={listening ? 'default' : 'outline'}
          className={listening ? 'animate-pulse' : undefined}
          aria-pressed={listening}
          aria-label={listening ? 'Stop listening' : 'Talk instead of typing'}
          title={listening ? 'Listening… tap to stop' : 'Talk instead of typing'}
          disabled={disabled && !listening}
          onClick={toggleListen}
        >
          <Mic />
        </Button>
      )}
      {canSpeak && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-pressed={speakOn}
          aria-label={speakOn ? 'Stop reading replies aloud' : 'Read replies aloud'}
          title={speakOn ? 'Replies are read aloud' : 'Read replies aloud'}
          onClick={toggleSpeak}
        >
          {speakOn ? <Volume2 /> : <VolumeX />}
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="px-2 text-xs text-muted-foreground"
        aria-label={`Voice language ${lang}. Switch to ${nextLang}`}
        title={`Voice language: ${lang}`}
        disabled={listening}
        onClick={() => setLang(nextLang)}
      >
        {lang.slice(0, 2).toUpperCase()}
      </Button>
      <span className="sr-only" aria-live="polite">{listening ? 'Listening' : ''}</span>
      {error && (
        <p
          role="status"
          className="absolute bottom-full left-0 mb-2 w-64 rounded-md border border-border bg-background p-2 text-xs text-muted-foreground shadow-sm"
        >
          {error}
        </p>
      )}
    </div>
  )
}
