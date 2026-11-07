import { canSpeak, speakable, type Lang } from './speech'

interface Job {
  text: string
  lang: Lang
  /** ElevenLabs audio, fetched as soon as the sentence is queued; null = speak with the browser voice. */
  audio: Promise<AudioBuffer | null>
}

/**
 * The fitter's voice (#51). Sentences are queued as the reply streams in; each one is fetched from
 * `POST /api/sessions/{id}/voice/tts` (ElevenLabs) right away, so the next sentence is ready when the
 * current one ends. No key, a cap or an error -> that sentence is spoken by the browser instead.
 * Plays through one AudioContext unlocked on the "Say it" tap (iOS and Chrome block audio otherwise).
 */
class Speaker {
  private ctx: AudioContext | null = null
  private queue: Job[] = []
  private source: AudioBufferSourceNode | null = null
  private playing = false
  private gen = 0
  private last = ''
  /** 'browser' after a 503 (no key) or a 429 (cap): stop asking the server this session. */
  private mode: 'elevenlabs' | 'browser' = 'elevenlabs'
  sessionId: string | null = null
  onChange: (speaking: boolean) => void = () => {}

  /** Call from the tap that turns voice on: creates and resumes the AudioContext inside the gesture. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (AC) this.ctx = new AC()
    }
    void this.ctx?.resume()
    if (this.ctx) {
      const s = this.ctx.createBufferSource()
      s.buffer = this.ctx.createBuffer(1, 1, 22050)
      s.connect(this.ctx.destination)
      s.start()
    }
  }

  get busy() {
    return this.playing || this.queue.length > 0
  }

  say(raw: string, lang: Lang) {
    const text = speakable(raw)
    if (!text) return
    const prev = this.last
    this.last = text
    this.queue.push({ text, lang, audio: this.load(text, prev, lang) })
    if (!this.playing) void this.next(this.gen)
  }

  stop() {
    this.gen++
    this.queue = []
    try {
      this.source?.stop()
    } catch {
      // already stopped
    }
    this.source = null
    if (canSpeak) window.speechSynthesis.cancel()
    if (this.playing) {
      this.playing = false
      this.onChange(false)
    }
  }

  private async load(text: string, previous: string, lang: Lang): Promise<AudioBuffer | null> {
    if (this.mode === 'browser' || !this.sessionId || !this.ctx) return null
    try {
      const r = await fetch(`/api/sessions/${this.sessionId}/voice/tts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 600), lang: lang.slice(0, 2), previous_text: previous.slice(-600) || null }),
      })
      if (r.status === 503 || r.status === 429) this.mode = 'browser'
      if (!r.ok) return null
      return await this.ctx.decodeAudioData(await r.arrayBuffer())
    } catch {
      return null
    }
  }

  private async next(gen: number) {
    const job = this.queue.shift()
    if (!job) {
      this.playing = false
      this.onChange(false)
      return
    }
    if (!this.playing) {
      this.playing = true
      this.onChange(true)
    }
    const buf = await job.audio
    if (gen !== this.gen) return
    const done = () => {
      if (gen === this.gen) void this.next(gen)
    }
    if (buf && this.ctx) {
      const s = this.ctx.createBufferSource()
      s.buffer = buf
      s.connect(this.ctx.destination)
      s.onended = done
      this.source = s
      s.start()
    } else if (canSpeak) {
      const u = new SpeechSynthesisUtterance(job.text)
      u.lang = job.lang
      u.onend = done
      u.onerror = done
      window.speechSynthesis.speak(u)
    } else done()
  }
}

export const speaker = new Speaker()
