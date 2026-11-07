import type { UIBlock } from '@/api/client'

/**
 * The C2 opening for an own fitting, shown the moment the studio opens, before the session exists.
 * The same copy as `backend/app/agent/opening.py` and turn 1 of `mock/scripts/own.yaml`: keep the three in step.
 * Persona sessions wait for the server instead (their card is prefilled from the questionnaire).
 */
export const GREETING = [
  'Hey, welcome to the studio. Pull up a chair, this takes about as long as a slow par 3.',
  "Let's start with you. How long have you been at this game?",
]

/** The local card's id. Answers go out with the id the opening turn gives the server's copy. */
export const OPENING_ID = 'opening'

const token = (id: string, placeholder: string, options: [string, string][]) => ({
  id,
  placeholder,
  options: options.map(([id, label]) => ({ id, label })),
})

export const OPENING_BLOCK: UIBlock = {
  type: 'sentence_builder',
  prompt: 'Tap the words to change them',
  template: "I've played golf for {years}, about {often}, and I'm {hand}, playing {sex} clubs, aged {age}",
  tokens: [
    token('years', 'how long', [['new', 'Just started'], ['1_3', '1–3 years'], ['3_10', '3–10 years'], ['10_plus', '10+ years']]),
    token('often', 'how often', [['weekly', 'every week'], ['2_3_month', '2–3 rounds a month'], ['season', 'a few a season'], ['starting', 'just starting']]),
    token('hand', 'right or left', [['right', 'right-handed'], ['left', 'left-handed']]),
    token('sex', "men's or women's", [['male', "men's"], ['female', "women's"]]),
    token('age', 'age', [['u25', 'under 25'], ['25_34', '25–34'], ['35_44', '35–44'], ['45_54', '45–54'], ['55_64', '55–64'], ['65_plus', '65+']]),
  ],
}
