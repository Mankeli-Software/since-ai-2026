// Line drawings for the body_measure illustration panel, copied from V3-C6a / C6b / C6 (#0B0B0B 2.5 stroke,
// orange measure line). `label` is the value printed next to the measure line (C6b "86 CM", C6 "19 CM").

const BODY = 'M100 56 V150 M100 150 L84 262 M100 150 L116 262 M100 76 L74 150 M100 76 L126 150'
const TICKS = Array.from({ length: 13 }, (_, i) => 24 + i * 20)

function Figure() {
  return (
    <>
      <circle cx="100" cy="40" r="16" fill="none" stroke="#0B0B0B" strokeWidth="2.5" />
      <path d={BODY} fill="none" stroke="#0B0B0B" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="40" y1="264" x2="200" y2="264" stroke="#0B0B0B" strokeWidth="2.5" />
    </>
  )
}

// HeightFigure: the person is drawn 240 units tall (head top y=24, ground y=264) at TALLEST cm and shrinks toward the
// ground line in proportion; the ruler stays put so the change reads against it.
const TALLEST = 210
const GROUND = 264
const ease = 'transition-transform duration-150 ease-out motion-reduce:transition-none'
const scaleFromGround = (s: number) => ({ transform: `scaleY(${s})`, transformBox: 'view-box', transformOrigin: `0 ${GROUND}px` }) as const
const lift = (dy: number) => ({ transform: `translateY(${dy}px)` })

export function HeightFigure({ cm = TALLEST }: { cm?: number }) {
  const r = Math.min(1, Math.max(0.5, cm / TALLEST))
  // Overall height (head top to ground) is r x 240. The head keeps its size and drops by dy; the body (neck y=56 to
  // ground, 208 units) and the measure line (240 units) stretch from the ground so their tops meet the head.
  const dy = 240 * (1 - r)
  const body = (208 - dy) / 208
  return (
    <svg viewBox="0 0 240 280" className="h-[280px] max-w-full" role="img" aria-label="Person standing next to a height ruler">
      <circle cx="100" cy="40" r="16" fill="none" stroke="#0B0B0B" strokeWidth="2.5" className={ease} style={lift(dy)} />
      <path
        d={BODY} fill="none" stroke="#0B0B0B" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke"
        className={ease} style={scaleFromGround(body)}
      />
      <line x1="40" y1={GROUND} x2="200" y2={GROUND} stroke="#0B0B0B" strokeWidth="2.5" />
      <line
        x1="170" y1="24" x2="170" y2={GROUND} stroke="#FF6E01" strokeWidth="2.5" vectorEffect="non-scaling-stroke"
        className={ease} style={scaleFromGround(r)}
      />
      <path d="M162 256 L170 264 L178 256" fill="none" stroke="#FF6E01" strokeWidth="2.5" />
      <g className={ease} style={lift(dy)}>
        <path d="M162 32 L170 24 L178 32" fill="none" stroke="#FF6E01" strokeWidth="2.5" />
        <line x1="88" y1="24" x2="166" y2="24" stroke="#FF6E01" strokeDasharray="3 4" />
      </g>
      <g stroke="#8F8F8F">
        {TICKS.map((y, i) => (
          <line key={y} x1="176" y1={y} x2={i % 2 ? 181 : 186} y2={y} />
        ))}
      </g>
    </svg>
  )
}

export function WristFigure({ label }: { label?: string }) {
  return (
    <svg viewBox="0 0 240 280" className="h-[280px] max-w-full" role="img" aria-label="Person standing relaxed, measured from wrist crease to the floor">
      <Figure />
      <circle cx="126" cy="150" r="5" fill="#FF6E01" />
      <line x1="160" y1="150" x2="160" y2="262" stroke="#FF6E01" strokeWidth="2.5" />
      <path d="M152 158 L160 150 L168 158 M152 254 L160 262 L168 254" fill="none" stroke="#FF6E01" strokeWidth="2.5" />
      <line x1="130" y1="150" x2="156" y2="150" stroke="#FF6E01" strokeDasharray="3 4" />
      {label && (
        <text x="170" y="212" fill="#C24F00" fontFamily="Barlow Condensed" fontWeight="700" fontSize="18">
          {label}
        </text>
      )}
    </svg>
  )
}

export function HandFigure({ label }: { label?: string }) {
  return (
    <svg viewBox="0 0 260 280" className="h-[280px] max-w-full" role="img" aria-label="Open hand measured from wrist crease to the tip of the middle finger">
      <path
        d="M70 250 L70 150 Q66 120 74 92 L80 60 Q84 48 92 52 Q98 56 96 70 L94 118 L100 40 Q104 26 113 28 Q121 32 119 46 L116 116 L124 34 Q128 22 137 24 Q145 28 143 42 L138 120 L148 56 Q152 44 160 47 Q168 51 165 64 L156 150 Q172 128 184 120 Q196 114 200 124 Q202 132 192 142 L160 200 Q150 230 140 250 Z"
        fill="none"
        stroke="#0B0B0B"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <line x1="40" y1="250" x2="40" y2="24" stroke="#FF6E01" strokeWidth="2.5" />
      <path d="M32 32 L40 24 L48 32 M32 242 L40 250 L48 242" fill="none" stroke="#FF6E01" strokeWidth="2.5" />
      <line x1="44" y1="24" x2="128" y2="24" stroke="#FF6E01" strokeDasharray="3 4" />
      <line x1="44" y1="250" x2="70" y2="250" stroke="#FF6E01" strokeDasharray="3 4" />
      {label && (
        <text x="200" y="210" fill="#C24F00" fontFamily="Barlow Condensed" fontWeight="700" fontSize="18">
          {label}
        </text>
      )}
    </svg>
  )
}
