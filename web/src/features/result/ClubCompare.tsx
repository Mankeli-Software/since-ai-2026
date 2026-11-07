import type { UIBlock } from '@/api/client'
import { cardCls, eyebrowCls } from '../genui/ui'

type P = Extract<UIBlock, { type: 'club_compare' }>

export function ClubCompareView({ heads, highlight }: { heads: P['heads']; highlight?: string | null }) {
  const cols = ['Head', 'Carry', 'Apex', 'Land angle', 'Side SD', 'Score']
  return (
    <section className={`${cardCls} gap-2 p-0`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            {cols.map((c, i) => (
              <th key={c} className={`px-4 py-3 ${eyebrowCls} ${i > 0 ? 'text-right' : ''}`}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {heads.map((h) => (
            <tr key={h.head} className={`border-b border-border last:border-b-0 ${h.head === highlight ? 'bg-orange-50' : ''}`}>
              <td className="px-4 py-2.5 font-display text-lg font-semibold uppercase">
                {h.head.replace('-', ' ')}
              </td>
              {[h.carry, h.apex, `${h.land_angle}°`, h.side_sd, h.score_total].map((v, i) => (
                <td key={i} className="px-4 py-2.5 text-right font-display text-lg font-medium tabular-nums">{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
