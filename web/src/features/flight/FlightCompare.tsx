/**
 * Compact side-view flight compare (R3 / K6 `flight_compare`): one arc per head, the selected head on
 * top in orange, the others grey, landing dots and a label per arc.
 *
 * The arcs are DRAWN, not simulated: each is a cubic bezier from the tee to `carry` whose highest point is
 * exactly `apex` and whose end tangent is exactly `land_angle`, on one shared scale (metres, x and y equal).
 * Solid arcs = carry from measured shots, dashed = guessed carry.
 * Deterministic, no physics claims; the host labels it "estimate". Replace with real trajectories once
 * the flight API exists (FIT #26).
 */

export interface FlightCompareArc {
  /** Stable id, e.g. the head slug. */
  id: string
  /** Short label, e.g. "201T". */
  label: string
  /** Metres. */
  carry: number
  /** Metres. */
  apex: number
  /** Degrees. */
  land_angle: number
}

export interface FlightCompareProps {
  arcs: FlightCompareArc[]
  /** Id of the highlighted arc (orange, drawn last). */
  selected: string
  /** Summary for screen readers (the SVG is role="img"). */
  ariaLabel: string
  className?: string
  /** Carry is a guess, not from measured shots: arcs are dashed. */
  guessed?: boolean
}

const W = 900
const H = 200
const GROUND = 184
const X0 = 40
const X1 = 880
const TOP = 30 // room above the highest apex for its label

const fmt = (n: number) => String(Math.round(n))

/** Bezier controls in metres: P0 (0,0), P1 (0.4c, h), P2 (c - h/tan θ, h), P3 (c, 0); h = apex / 0.75. */
function controls(a: FlightCompareArc) {
  const h = a.apex / 0.75 // y(t) = 3t(1-t)h peaks at t = .5 with 0.75h
  const p1x = 0.4 * a.carry
  const tan = Math.tan((Math.max(5, Math.min(85, a.land_angle)) * Math.PI) / 180)
  const p2x = Math.max(p1x + 1, a.carry - h / tan)
  return { h, p1x, p2x, apexX: (3 * p1x + 3 * p2x + a.carry) / 8 }
}

export function FlightCompare({ arcs, selected, ariaLabel, className, guessed }: FlightCompareProps) {
  const valid = arcs.filter((a) => a.carry > 0 && a.apex > 0)
  const maxCarry = Math.max(1, ...valid.map((a) => a.carry))
  const maxApex = Math.max(1, ...valid.map((a) => a.apex))
  const domain = maxCarry * 1.2
  const s = Math.min((X1 - X0) / domain, (GROUND - TOP) / maxApex)
  const x = (m: number) => X0 + m * s
  const y = (m: number) => GROUND - m * s

  const ticks: number[] = []
  for (let t = 0; t <= domain; t += 50) ticks.push(t)

  // Draw the selected arc last so it sits on top.
  const ordered = [...valid].sort((a, b) => Number(a.id === selected) - Number(b.id === selected))
  const highest = valid.reduce<FlightCompareArc | null>((m, a) => (!m || a.apex > m.apex ? a : m), null)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={ariaLabel}>
      <line x1="20" y1={GROUND} x2={W - 20} y2={GROUND} stroke="#3D3D3D" />
      <g fill="#8F8F8F" fontFamily="Barlow" fontSize="12">
        {ticks.map((t, i) => (
          <text key={t} x={x(t) - 4} y="198">
            {t}
            {i === ticks.length - 1 ? ' m' : ''}
          </text>
        ))}
      </g>
      {ordered.map((a) => {
        const on = a.id === selected
        const c = controls(a)
        const d = `M${x(0)} ${GROUND} C ${x(c.p1x)} ${y(c.h)} ${x(c.p2x)} ${y(c.h)} ${x(a.carry)} ${GROUND}`
        const top = a.id === highest?.id
        // The higher arc's label sits above its apex, the lower one's just under its own apex.
        const ly = top ? y(a.apex) - 10 : y(a.apex) + 30
        return (
          <g key={a.id}>
            <path d={d} fill="none" stroke={on ? '#FF6E01' : '#C8C8C8'} strokeWidth={on ? 4 : 2} strokeLinecap="round" strokeDasharray={guessed ? (on ? '10 8' : '6 6') : undefined} />
            <circle cx={x(a.carry)} cy={GROUND} r={on ? 6 : 5} fill={on ? '#FF6E01' : '#C8C8C8'} />
            <text
              x={x(c.apexX)}
              y={ly}
              textAnchor="middle"
              fill={on ? '#FF8A33' : '#C8C8C8'}
              fontFamily="Barlow Condensed"
              fontWeight="700"
              fontSize={on ? 16 : 15}
              style={{ paintOrder: 'stroke' }}
              stroke="#121212"
              strokeWidth="4"
            >
              {a.label.toUpperCase()}: APEX {fmt(a.apex)} M, LANDS {fmt(a.land_angle)}°
            </text>
          </g>
        )
      })}
    </svg>
  )
}
