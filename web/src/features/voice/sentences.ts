/**
 * A sentence is done once its end mark is followed by whitespace. A mark followed by anything else
 * ("124.7", "e.g.x") stays inside the sentence, so decimals neither split nor stall the stream.
 */
const SENTENCE = /(?:[^.!?\n]|[.!?](?![.!?]*["”')\]]*(?:\s|$)))*?(?:[.!?]+["”')\]]*\s+|\n+)/gy

/**
 * The complete sentences of a streaming reply from character `from` on, grouped to at least ~40
 * characters so a short "Got it." doesn't cost its own round trip. With `final`, the tail goes too.
 */
export function takeSentences(text: string, from: number, final: boolean): { parts: string[]; next: number } {
  const parts: string[] = []
  let chunk = ''
  let next = from
  SENTENCE.lastIndex = from
  for (let m = SENTENCE.exec(text); m && m[0]; m = SENTENCE.exec(text)) {
    chunk += m[0]
    if (chunk.trim().length >= 40) {
      parts.push(chunk.trim())
      chunk = ''
      next = SENTENCE.lastIndex
    }
  }
  if (final) {
    const tail = text.slice(next).trim()
    if (tail) parts.push(tail)
    next = text.length
  }
  return { parts, next }
}
