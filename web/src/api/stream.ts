import { createParser } from 'eventsource-parser'
import type { StreamEvent, TurnRequest } from './client'

/**
 * POST /api/sessions/{id}/turn and yield the typed SSE events in `seq` order.
 * Abort with the signal; an aborted stream ends quietly. Errors before the stream starts (404/409/422) throw.
 */
export async function* streamTurn(
  sessionId: string,
  body: TurnRequest,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok || !res.body) throw new Error(`turn failed: HTTP ${res.status}`)

  const pending: StreamEvent[] = []
  const parser = createParser({
    onEvent: (e) => pending.push(JSON.parse(e.data) as StreamEvent),
  })
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let next = 0 // the server numbers events 0.. within a turn; hold back anything that arrives early
  const early = new Map<number, StreamEvent>()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      parser.feed(value)
      for (const ev of pending.splice(0)) {
        early.set(ev.seq, ev)
        for (let e = early.get(next); e; e = early.get(next)) {
          early.delete(next++)
          yield e
        }
      }
    }
  } catch (err) {
    if (signal?.aborted) return
    throw err
  }
  yield* [...early.entries()].sort((a, b) => a[0] - b[0]).map(([, e]) => e) // gaps: flush what we have
}
