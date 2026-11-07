/**
 * Static QR-style picture for R4 (TASKS T4b: real QR generation is a later task, no new deps). It does NOT
 * encode anything: the host shows the real link as text next to it. The module pattern is a fixed
 * pseudo-random fill seeded from `seed`, so it is stable between renders.
 */

const N = 25 // modules per side
const CELL = 8 // viewBox units per module (25 * 8 = 200)

function finder(x: number, y: number) {
  return (
    <g key={`f-${x}-${y}`}>
      <rect x={x * CELL} y={y * CELL} width={7 * CELL} height={7 * CELL} fill="#0B0B0B" />
      <rect x={(x + 1) * CELL} y={(y + 1) * CELL} width={5 * CELL} height={5 * CELL} fill="#FFFFFF" />
      <rect x={(x + 2) * CELL} y={(y + 2) * CELL} width={3 * CELL} height={3 * CELL} fill="#0B0B0B" />
    </g>
  )
}

const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8)

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function QrPlaceholder({ seed, label, className }: { seed: string; label: string; className?: string }) {
  const base = hash(seed)
  const cells: [number, number][] = []
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (inFinder(x, y)) continue
      if (hash(`${base}:${x}:${y}`) % 100 < 46) cells.push([x, y])
    }
  }
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width="200" height="200" fill="#FFFFFF" />
      <g fill="#0B0B0B">
        {cells.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x * CELL} y={y * CELL} width={CELL} height={CELL} />
        ))}
      </g>
      {finder(0, 0)}
      {finder(N - 7, 0)}
      {finder(0, N - 7)}
    </svg>
  )
}
