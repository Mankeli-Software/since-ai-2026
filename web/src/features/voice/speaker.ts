import { canSpeak, speakable, type Lang } from './speech'

interface Job {
  text: string
  lang: Lang
  /** The sentence before, sent as `previous_text` so ElevenLabs keeps the intonation continuous. */
  prev: string
  /** ElevenLabs audio, loaded at most one sentence ahead; null = this sentence can't use it. */
  audio?: Promise<AudioBuffer | null>
}

const RETRYABLE = new Set([429, 500, 502, 504])

/**
 * The fitter's voice (#51). Sentences are queued as the reply streams in. Each one is fetched from
 * `POST /api/sessions/{id}/voice/tts` (ElevenLabs) while the sentence before it plays, so at most two requests
 * are in flight (ElevenLabs Starter allows only a few at once). A failed sentence is retried once; if it still
 * fails, the rest of the session uses the browser voice, so the fitter never flips between two voices.
 * Plays through one AudioContext unlocked on the "Say it" tap (iOS and Chrome block audio otherwise).
 */
class Speaker {
  private ctx: AudioContext | null = null
  private queue: Job[] = []
  private source: AudioBufferSourceNode | null = null
  private playing = false
  private gen = 0
  private last = ''
  /** 'browser' after no key (503), a cap (429) or a failure that survived the retry. Sticky for the session. */
  private mode: 'elevenlabs' | 'browser' = 'elevenlabs'
  private session: string | null = null
  onChange: (speaking: boolean) => void = () => {}

  set sessionId(id: string | null) {
    if (id !== this.session) this.mode = 'elevenlabs' // a new fitting tries ElevenLabs again
    this.session = id
  }
  get sessionId() {
    return this.session
  }

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
    this.queue.push({ text, lang, prev: this.last })
    this.last = text
    if (!this.playing) void this.next(this.gen)
    else this.prefetch()
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

  /** Start loading the next queued sentence while the current one plays. */
  private prefetch() {
    const j = this.queue[0]
    if (j && !j.audio) j.audio = this.load(j)
  }

  private async load(j: Job): Promise<AudioBuffer | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (this.mode === 'browser' || !this.session || !this.ctx) return null
      let status: number
      try {
        const r = await fetch(`/api/sessions/${this.session}/voice/tts`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: j.text.slice(0, 600), lang: j.lang.slice(0, 2), previous_text: j.prev.slice(-600) || null }),
        })
        status = r.status
        if (r.ok) return await this.ctx.decodeAudioData(await r.arrayBuffer())
      } catch {
        status = 0 // network error or undecodable audio: worth one retry
      }
      if (!(status === 0 || RETRYABLE.has(status)) || attempt === 1) break
      await new Promise((ok) => setTimeout(ok, 400))
    }
    this.mode = 'browser'
    return null
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
    job.audio ??= this.load(job)
    this.prefetch()
    const loaded = await job.audio
    if (gen !== this.gen) return
    // Once the session is on the browser voice, a sentence that did load is not played: one voice throughout.
    const buf = this.mode === 'elevenlabs' ? loaded : null
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
