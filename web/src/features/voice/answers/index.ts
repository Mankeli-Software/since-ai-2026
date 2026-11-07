import type { UIBlock } from '@/api/client'
import type { AnswerModule, Heard, VoiceCtx } from './types'

const mods = import.meta.glob<AnswerModule>(['./*.ts', '!./index.ts', '!./types.ts'], { eager: true, import: 'default' })
const byType = new Map(Object.values(mods).filter(Boolean).map((m) => [m.type, m]))

/** What the fitter says to ask this card out loud. Cards without a module read their prompt. */
export function askFor(block: UIBlock, ctx: VoiceCtx): string {
  const m = byType.get(block.type)
  if (m) return m.ask(block as never, ctx)
  return 'prompt' in block && typeof block.prompt === 'string' ? block.prompt : ''
}

/** The card's own answer for what was said, or null: then it goes to the chat as text. */
export async function resolveAnswer(block: UIBlock, said: string, ctx: VoiceCtx): Promise<Heard | null> {
  const m = byType.get(block.type)
  if (!m?.resolve) return null
  try {
    return (await m.resolve(block as never, said, ctx)) ?? null
  } catch {
    return null
  }
}
