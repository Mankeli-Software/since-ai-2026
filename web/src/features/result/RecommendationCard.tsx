import social from '../../../../fixtures/social_proof.json'
import { HonestEnding } from './HonestEnding'
import type { Spec, Gate } from './types'

const proof = social as Record<string, { text: string; example: boolean }>

const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`

function specRows(s: Spec): [string, string][] {
  return [
    ['Shaft', s.shaft_model ? `${s.shaft_model} (${s.shaft})` : s.shaft],
    ['Flex', s.flex],
    ['Material', s.material],
    ['Length', `${s.length_in} in`],
    ['Lie', `${signed(s.lie_deg)}°`],
    ['Grip', s.grip],
    ['Hand', s.handedness],
  ]
}

function headline(gate: Gate, strength?: 'low' | null) {
  if (gate === 'confident') return 'Our recommendation'
  if (gate === 'provisional') return strength === 'low' ? 'Provisional: add data to firm this up' : 'Provisional recommendation'
  return 'Not enough to recommend yet'
}

export function RecommendationCardView(p: {
  spec: Spec
  purchase: 'stock' | 'custom'
  confidence: number
  gate: Gate
  strength?: 'low' | null
  runner_up?: Spec | null
  social_proof_id?: string | null
}) {
  const sp = p.social_proof_id ? proof[p.social_proof_id] : undefined
  const rec = p.gate === 'confident' || p.gate === 'provisional'
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold">{headline(p.gate, p.strength)}</span>
        <span className="rounded-full bg-secondary px-2 py-0.5">
          {Math.round(p.confidence * 100)}% sure
        </span>
      </div>
      {rec && (
        <>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-3xl uppercase">{p.spec.head}</h3>
            <span className="rounded bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
              {p.purchase === 'stock' ? 'Stock' : 'Custom'}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {specRows(p.spec).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-border py-0.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {p.runner_up && (
            <p className="text-xs text-muted-foreground">
              Runner-up: {p.runner_up.head}, {p.runner_up.flex}, {p.runner_up.length_in} in, lie {signed(p.runner_up.lie_deg)}°
            </p>
          )}
        </>
      )}
      {p.gate !== 'confident' && <HonestEnding gate={p.gate} />}
      {sp && (
        <p className="text-xs text-muted-foreground">
          <span className="mr-1 rounded border border-border px-1">Example</span>
          {sp.text}
        </p>
      )}
    </section>
  )
}
