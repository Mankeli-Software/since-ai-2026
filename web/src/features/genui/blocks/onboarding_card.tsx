import { useState } from 'react'
import { EnterKbd, useEnterKey } from '@/components/studio'
import { Button } from '@/components/ui/button'
import { answeredCls, btnCls, inputCls, labelCls, promptCls } from '../ui'
import type { BlockProps } from '../types'

export const type = 'onboarding_card'

const ROUNDS = ['Under 10', '10-30', '31-50', 'Over 50']
const SCORES = [
  [1, 'Scratch / Under 72'], [2, 'Low 70s (72–77)'], [3, 'Broke 80 (78–84)'], [4, 'Mid 80s to low 90s (85–92)'], [5, '93+ (Still chasing it)'],
] as const

export function Component({ block, interactive, answer, busy, respond }: BlockProps<'onboarding_card'>) {
  const [age, setAge] = useState(block.age ?? '')
  const [sex, setSex] = useState<string>(block.sex ?? '')
  const [hand, setHand] = useState<string>(block.handedness ?? '')
  const [rounds, setRounds] = useState<string>(block.rounds_per_year ?? '')
  const [score, setScore] = useState<number | ''>(block.typical_score ?? '')
  const off = !interactive || busy
  const ready = age !== '' && sex && hand && rounds && score !== ''
  const submit = () => {
    const label = SCORES.find(([n]) => n === score)?.[1]
    respond(
      { age: Number(age), sex, handedness: hand, rounds_per_year: rounds, typical_score: score },
      `${age} yrs, ${sex === 'female' ? "women's" : "men's"} standard, ${hand}-handed, ${rounds} rounds a year, scores ${label}`,
    )
  }
  // Several fields, so no number keys; Enter (outside a field) continues once every field is set.
  useEnterKey(submit, !off && !!ready)
  return (
    <div className="flex flex-col gap-3">
      <p className={promptCls}>{block.prompt}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <label className={labelCls}>Age
          <input type="number" min={8} max={100} className={inputCls} value={age} disabled={off} onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))} />
        </label>
        <label className={labelCls}>Club build
          <select className={inputCls} value={sex} disabled={off} onChange={(e) => setSex(e.target.value)}>
            <option value="">Choose</option><option value="male">Men's standard</option><option value="female">Women's standard</option>
          </select>
        </label>
        <label className={labelCls}>How do you swing?
          <select className={inputCls} value={hand} disabled={off} onChange={(e) => setHand(e.target.value)}>
            <option value="">Choose</option><option value="right">Right-handed</option><option value="left">Left-handed</option>
          </select>
        </label>
        <label className={labelCls}>Rounds a year
          <select className={inputCls} value={rounds} disabled={off} onChange={(e) => setRounds(e.target.value)}>
            <option value="">Choose</option>
            {ROUNDS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <label className={`${labelCls} col-span-2`}>Typical 18-hole score
          <select className={inputCls} value={score} disabled={off} onChange={(e) => setScore(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">Choose</option>
            {SCORES.map(([n, l]) => <option key={n} value={n}>{l}</option>)}
          </select>
        </label>
      </div>
      {interactive ? (
        <Button className={`self-start ${btnCls}`} disabled={off || !ready} aria-keyshortcuts="Enter" onClick={submit}>
          Continue
          <EnterKbd />
        </Button>
      ) : (
        answer && <p className={answeredCls}>You told me: <strong>{answer.displayText}</strong></p>
      )}
    </div>
  )
}
