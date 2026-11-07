import type { UIBlock } from '@/api/client'

type P = Extract<UIBlock, { type: 'club_compare' }>

export function ClubCompareView({ heads, highlight }: { heads: P['heads']; highlight?: string | null }) {
  const cols = ['Head', 'Carry', 'Apex', 'Land angle', 'Side SD', 'Score']
  return (
    <table className="w-full rounded-lg border border-border bg-background text-sm">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          {cols.map((c) => (
            <th key={c} className="p-2 font-medium">{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {heads.map((h) => (
          <tr key={h.head} className={h.head === highlight ? 'bg-muted font-semibold' : ''}>
            <td className="p-2">{h.head}</td>
            <td className="p-2">{h.carry}</td>
            <td className="p-2">{h.apex}</td>
            <td className="p-2">{h.land_angle}°</td>
            <td className="p-2">{h.side_sd}</td>
            <td className="p-2">{h.score_total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
