import social from '../../../../fixtures/social_proof.json'
import { cardCls, eyebrowCls } from '../genui/ui'
import { HonestEnding } from './HonestEnding'
import type { Spec, Gate } from './types'

const proof = social as Record<string, { text: string; example: boolean }>

const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`
const lieWord = (n: number) => (n > 0 ? 'upright' : n < 0 ? 'flat' : 'standard')
const headName = (h: string) => h.replace('-', ' ')

function detailRows(s: Spec): [string, string][] {
  return [
    ['Shaft', s.shaft_model ? `${s.shaft_model} (${s.shaft})` : s.shaft],
    ['Material', s.material],
    ['Grip', s.grip],
    ['Hand', s.handedness],
  ]
}

function headline(gate: Gate, strength?: 'low' | null) {
  if (gate === 'confident') return 'Our recommendation'
  if (gate === 'provisional') return strength === 'low' ? 'Provisional: add data to firm this up' : 'Provisional recommendation'
  return 'Not enough to recommend yet'
}

/** Confidence badge: filled black when confident, calm orange outline when provisional or not yet enough. */
function ConfidenceBadge({ confidence, gate }: { confidence: number; gate: Gate }) {
  const firm = gate === 'confident'
  return (
    <span
      className={`inline-flex items-baseline gap-1.5 rounded-md border px-2.5 py-1 ${
        firm ? 'border-ink-900 bg-ink-900 text-washed-white' : 'border-orange-300 bg-orange-50 text-orange-ink'
      }`}
    >
      <span className="font-display text-xl font-semibold leading-none">{Math.round(confidence * 100)}%</span>
      <span className="font-display text-xs font-semibold uppercase tracking-[0.12em]">sure</span>
    </span>
  )
}

function Tile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-background px-4 py-3">
      <span className={eyebrowCls}>{label}</span>
      <span className="font-display text-4xl font-semibold leading-none">
        {value}
        {unit && <span className="ml-1 text-xl font-medium text-ink-500">{unit}</span>}
      </span>
    </div>
  )
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
    <section className={cardCls}>
      <div className="flex items-center justify-between gap-3">
        <span className={eyebrowCls}>{headline(p.gate, p.strength)}</span>
        <ConfidenceBadge confidence={p.confidence} gate={p.gate} />
      </div>
      {rec && (
        <>
          <div className="flex items-center gap-3">
            <h3 className="font-display text-5xl font-semibold uppercase leading-none">{headName(p.spec.head)}</h3>
            <span className="rounded-md border border-ink-900 px-2 py-0.5 font-display text-xs font-semibold uppercase tracking-[0.14em]">
              {p.purchase === 'stock' ? 'Stock' : 'Custom'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Tile label="Lie" value={`${signed(p.spec.lie_deg)}°`} unit={lieWord(p.spec.lie_deg)} />
            <Tile label="Length" value={p.spec.length_in.toFixed(2).replace(/0$/, '')} unit="in" />
            <Tile label="Flex" value={p.spec.flex.charAt(0).toUpperCase() + p.spec.flex.slice(1)} />
          </div>
          <dl className="grid grid-cols-2 gap-x-6">
            {detailRows(p.spec).map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 border-t border-border py-2 text-sm">
                <dt className={eyebrowCls}>{k}</dt>
                <dd className={`text-right font-medium ${k === 'Shaft' ? '' : 'capitalize'}`}>{v}</dd>
              </div>
            ))}
          </dl>
          {p.runner_up && (
            <p className="border-t border-border pt-3 text-sm text-ink-500">
              <span className={`${eyebrowCls} mr-2`}>Runner-up</span>
              <span className="font-medium uppercase text-foreground">{headName(p.runner_up.head)}</span>, {p.runner_up.flex}, {p.runner_up.length_in} in, lie {signed(p.runner_up.lie_deg)}°
            </p>
          )}
        </>
      )}
      {p.gate !== 'confident' && <HonestEnding gate={p.gate} />}
      {sp && (
        <p className="flex items-baseline gap-2 text-xs text-ink-500">
          <span className="rounded-sm border border-border px-1.5 py-px font-display font-semibold uppercase tracking-[0.12em]">Example</span>
          {sp.text}
        </p>
      )}
    </section>
  )
}

