import type { BlockOf, BlockType } from '@/features/genui/types'

/** A card answer, exactly what tapping the card would send: `respond(value, display)`. */
export interface Heard {
  value: unknown
  display: string
}

export interface VoiceCtx {
  sessionId: string
  demo: string | null
}

/**
 * One file per input card in `answers/<type>.ts` (collected with `import.meta.glob`, no central map).
 * `ask` is what the fitter says to put the card's question out loud; `resolve` maps an utterance to the
 * card's own answer, or null to send it to the chat as text.
 */
export interface AnswerModule<T extends BlockType = BlockType> {
  type: T
  ask(block: BlockOf<T>, ctx: VoiceCtx): string
  resolve?(block: BlockOf<T>, said: string, ctx: VoiceCtx): Heard | null | Promise<Heard | null>
}

/** "A, B or C" for a spoken list. */
export const orList = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`
