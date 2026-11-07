import type { AnswerModule } from './types'

/** No resolver: a spoken description goes to the chat, where the fitter parses every field at once. */
export default {
  type: 'sentence_builder',
  ask: (b) => `${b.prompt} Just tell me in your own words.`,
} satisfies AnswerModule<'sentence_builder'>
