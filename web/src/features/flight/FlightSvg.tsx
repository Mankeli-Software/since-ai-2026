import { useId, useMemo } from "react";
import type { Ellipse, FlightResult } from "./types";

export interface FlightSvgProps {
  data: FlightResult;
  /** Overrides `recommended` flags in the data. */
  recommendedSlug?: string;
  className?: string;
  view?: "all" | "top" | "side";
  guessed?: boolean;
  caption?: string;
}

const NAMES: Record<string, string> = {
  "101-mkii": "101 MKII",
  "201-mkii": "201 MKII",
  "201t-mkii": "201T MKII",
  "301-cb": "301 CB",
  "301-mb": "301 MB",
};

// Monochrome brand palette on a dark simulator background: slot 0 = Tiger Orange (recommended), then white and grey.
const SLOT = ["var(--color-tiger-orange,#ff6e01)", "#f8f8f8", "#c8c8c8", "#c8c8c8", "#c8c8c8"];
const css = SLOT.map((c, i) => `--fl-${i}:${c};`).join("");
const STYLE = `
.flight-svg{--fl-bg:#121212;--fl-ink:#f8f8f8;--fl-ink2:#c8c8c8;--fl-muted:#8f8f8f;--fl-grid:#262626;--fl-axis:#3d3d3d;${css}}
.flight-svg text{font-family:inherit;font-size:12px;fill:var(--fl-ink2)}
.flight-svg .mut{fill:var(--fl-muted);font-size:11px}
.flight-svg .strong{fill:var(--fl-ink);font-weight:600}
.flight-svg .halo{paint-order:stroke;stroke:var(--fl-bg);stroke-width:4px}
`;

const W = 840;
const ML = 44;
const GUT = 190;
const PW = W - ML - GUT;
const GAP = 52;
const f0 = (n: number) => Math.round(n).toString();

function ext(e: Ellipse) {
  const a = (e.angle_deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { hx: Math.hypot(e.rx * c, e.rz * s), hz: Math.hypot(e.rx * s, e.rz * c) };
}

/** Spread label y positions so they are at least `gap` apart, keeping order. */
function spread(ys: number[], gap: number, lo: number, hi: number) {
  const idx = ys.map((_, i) => i).sort((a, b) => ys[a] - ys[b]);
  const out = [...ys];
  let prev = lo - gap;
  for (const i of idx) {
    out[i] = Math.max(ys[i], prev + gap);
    prev = out[i];
  }
  const over = prev - hi;
  if (over > 0) for (const i of idx) out[i] -= over;
  return out;
}

function ticks(max: number, step: number) {
  const t: number[] = [];
  for (let v = 0; v <= max + 1e-6; v += step) t.push(v);
  return t;
}

export function FlightSvg({ data, recommendedSlug, className, view = "all", guessed = false, caption }: FlightSvgProps) {
  const uid = useId();
  const isTopOnly = view === "top";
  const isSideOnly = view === "side";

  const L = useMemo(() => {
    const heads = data.per_head.slice(0, 5).map((h, i) => ({
      h,
      name: h.label ?? NAMES[h.head] ?? h.head,
      rec: recommendedSlug ? h.head === recommendedSlug : !!h.recommended,
      i,
    }));
    // slot 0 reserved for the recommended head; the others take 1.. in data order
    let next = 1;
    const items = heads.map((x) => ({ ...x, slot: x.rec ? 0 : Math.min(next++, 4) }));

    const ownShots: [number, number][] = (data.own_shots ?? []).map((s) => [s[0], s[1] ?? 0]);
    const ownAvgCarry = ownShots.length > 0 ? ownShots.reduce((a, s) => a + s[0], 0) / ownShots.length : 0;
    const ownAvgSide = ownShots.length > 0 ? ownShots.reduce((a, s) => a + s[1], 0) / ownShots.length : 0;

    let allXMax = Math.max(
      50,
      ...items.map(({ h }) => h.summary.carry.mean + (h.ellipses ? ext(h.ellipses.two_sigma).hx : 8)),
    );
    let allXMin = Math.min(
      ...items.map(({ h }) => h.summary.carry.mean - (h.ellipses ? ext(h.ellipses.two_sigma).hx : 8)),
    );
    if (ownShots.length > 0) {
      allXMax = Math.max(allXMax, ...ownShots.map((s) => s[0] + 6));
      allXMin = Math.min(allXMin, ...ownShots.map((s) => s[0] - 6));
    }

    const xMax = Math.max(50, Math.ceil(allXMax / 25) * 25);
    const s = PW / xMax;
    const apexMax = Math.max(10, ...items.map(({ h }) => h.summary.apex));

    let lat = 20;
    for (const { h } of items) {
      const z = h.summary.side?.mean ?? h.ellipses?.two_sigma.cz ?? 0;
      const half = h.ellipses ? ext(h.ellipses.two_sigma).hz : (h.summary.side?.sd ?? 5) * 2;
      lat = Math.max(lat, Math.abs(z) + half + 2);
    }
    for (const sPt of ownShots) {
      lat = Math.max(lat, Math.abs(sPt[1]) + 4);
    }
    lat = Math.ceil(lat / 5) * 5;

    const sideH = isTopOnly ? 0 : Math.max(110, apexMax * 1.35 * s);
    const sideY0 = isTopOnly ? 0 : 30;

    // top view has its own x window (zoomed on the landing area), same scale on both axes
    const TOP_H = isTopOnly ? 210 : 280;
    const want = PW / (TOP_H / (2 * lat));
    const left = allXMin;
    const xMin = Math.max(0, Math.min(Math.ceil((xMax - want) / 25) * 25, Math.floor(left / 25) * 25));
    const ts = PW / (xMax - xMin);
    const topH = isSideOnly ? 0 : 2 * lat * ts;
    const topY0 = isTopOnly ? 24 : sideY0 + sideH + GAP + 14;
    const H = isSideOnly ? sideY0 + sideH + 30 : isTopOnly ? topY0 + topH + 36 : topY0 + topH + 30;

    // recommended last so it draws on top
    const order = [...items].sort((a, b) => Number(a.rec) - Number(b.rec));

    const TX_fn = (x: number) => ML + (x - xMin) * ts;
    const TY_fn = (z: number) => topY0 + topH / 2 + z * ts;

    const topLabels = items.map(({ h, name, rec, slot }, idx) => {
      const e = h.ellipses ? ext(h.ellipses.two_sigma).hx : 6;
      return {
        key: `head-${h.head}-${idx}`,
        name,
        carry: h.summary.carry.mean,
        rec,
        slot,
        ax: TX_fn(h.summary.carry.mean + e) + 4,
        ay: TY_fn(h.summary.side?.mean ?? h.ellipses?.one_sigma.cz ?? 0),
        isOwn: false,
      };
    });
    if (ownShots.length > 0) {
      topLabels.push({
        key: "own-shots",
        name: "Your 7-iron",
        carry: ownAvgCarry,
        rec: false,
        slot: -1,
        ax: TX_fn(ownAvgCarry) + 6,
        ay: TY_fn(ownAvgSide),
        isOwn: true,
      });
    }

    const anchors = topLabels.map((l) => l.ay);
    const labelYs = spread(anchors, 18, topY0 + 6, topY0 + topH - 6);

    return {
      items,
      order,
      apexMax,
      xMax,
      xMin,
      ts,
      s,
      lat,
      sideH,
      topH,
      sideY0,
      topY0,
      H,
      ownShots,
      ownAvgCarry,
      ownAvgSide,
      topLabels,
      labelYs,
    };
  }, [data, recommendedSlug, isTopOnly, isSideOnly]);

  const {
    items,
    order,
    apexMax,
    xMax,
    xMin,
    ts,
    s,
    lat,
    sideH,
    topH,
    sideY0,
    topY0,
    H,
    ownShots,
    ownAvgCarry,
    ownAvgSide,
    topLabels,
    labelYs,
  } = L;

  const gy = sideY0 + sideH; // ground line in side view
  const X = (x: number) => ML + x * s;
  const SY = (y: number) => gy - y * s;
  const TX = (x: number) => ML + (x - xMin) * ts;
  const TY = (z: number) => topY0 + topH / 2 + z * ts;
  const col = (slot: number) => `var(--fl-${slot})`;

  const summary = [
    ...items.map(({ name, h, rec }) => `${name}${rec ? " (recommended)" : ""}: carry ${f0(h.summary.carry.mean)} yd, apex ${f0(h.summary.apex)} yd`),
    ...(ownShots.length > 0 ? [`Your 7-iron: carry ${f0(ownAvgCarry)} yd (${ownShots.length} shots)`] : []),
  ].join("; ");

  const sideOrder = [...items].sort((a, b) => b.h.summary.apex - a.h.summary.apex);
  const recItem = items.find((it) => it.rec) ?? items[0];

  return (
    <svg
      className={`flight-svg${className ? ` ${className}` : ""}`}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-labelledby={`${uid}t ${uid}d`}
      style={{ display: "block", maxHeight: "100%", background: "var(--fl-bg)" }}
    >
      <title id={`${uid}t`}>Simulated ball flight, side and top view</title>
      <desc id={`${uid}d`}>{summary}. Estimated by Takomo's physics model, yards.</desc>
      <style>{STYLE}</style>

      {/* SIDE VIEW */}
      {!isTopOnly && (
        <>
          <text x={ML} y={16} className="mut">SIDE VIEW (yd)</text>
          {ticks(xMax, 25).map((v) => (
            <g key={`sx${v}`}>
              <line x1={X(v)} x2={X(v)} y1={sideY0} y2={gy} stroke="var(--fl-grid)" />
              <text x={X(v)} y={gy + 15} textAnchor="middle" className="mut">{v}</text>
            </g>
          ))}
          {ticks(Math.floor(sideH / s), 10).slice(1).map((v) => (
            <g key={`sy${v}`}>
              <line x1={ML} x2={ML + PW} y1={SY(v)} y2={SY(v)} stroke="var(--fl-grid)" />
              <text x={ML - 6} y={SY(v) + 4} textAnchor="end" className="mut">{v}</text>
            </g>
          ))}
          <line x1={ML} x2={ML + PW} y1={gy} y2={gy} stroke="var(--fl-axis)" strokeWidth={1.5} />
          {order.map(({ h, rec, slot, i }) => {
            const pts = h.trajectory?.map((p) => `${X(p[0]).toFixed(1)},${SY(p[1]).toFixed(1)}`).join(" ");
            const ax = h.trajectory?.reduce((m, p) => (p[1] > m[1] ? p : m))[0] ?? h.summary.carry.mean / 2;
            return (
              <g key={`s${h.head}-${i}`} opacity={rec ? 1 : 0.8}>
                {pts && (
                  <polyline
                    points={pts}
                    fill="none"
                    stroke={col(slot)}
                    strokeWidth={rec ? 3 : 2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={guessed ? (rec ? "8 6" : "5 5") : undefined}
                  />
                )}
                <circle cx={X(ax)} cy={SY(h.summary.apex)} r={rec ? 5 : 4} fill={col(slot)} stroke="var(--fl-bg)" strokeWidth={2} />
                {rec && (
                  <>
                    <text x={X(ax)} y={SY(apexMax) - 12} textAnchor="middle" className="strong halo">apex {f0(h.summary.apex)} yd</text>
                    <text x={X(h.summary.carry.mean)} y={gy + 29} textAnchor="middle" className="strong">carry {f0(h.summary.carry.mean)} yd</text>
                  </>
                )}
              </g>
            );
          })}
          {sideOrder.map(({ h, name, rec, slot, i }, k) => (
            <g key={`sg${h.head}-${i ?? k}`}>
              <circle cx={ML + PW + 16} cy={sideY0 + 8 + k * 17} r={4.5} fill={col(slot)} />
              <text x={ML + PW + 26} y={sideY0 + 12 + k * 17} className={rec ? "strong" : undefined}>{name} · apex {f0(h.summary.apex)} yd</text>
            </g>
          ))}
        </>
      )}

      {/* TOP VIEW */}
      {!isSideOnly && (
        <>
          <text x={ML} y={topY0 - 8} className="mut">
            {ownShots.length > 0 && recItem
              ? `TOP VIEW (yd) · your shots vs the ${recItem.name} · right of target is down`
              : "TOP VIEW (yd) · right of target is down"}
          </text>
          {ticks(xMax, 25).filter((v) => v >= xMin).map((v) => (
            <g key={`tx${v}`}>
              <line x1={TX(v)} x2={TX(v)} y1={topY0} y2={topY0 + topH} stroke="var(--fl-grid)" />
              <text x={TX(v)} y={topY0 + topH + 15} textAnchor="middle" className="mut">{v}</text>
            </g>
          ))}
          {[-30, -20, -10, 10, 20, 30].filter((v) => Math.abs(v) < lat).map((v) => (
            <g key={`ty${v}`}>
              <line x1={ML} x2={ML + PW} y1={TY(v)} y2={TY(v)} stroke="var(--fl-grid)" />
              <text x={ML - 6} y={TY(v) + 4} textAnchor="end" className="mut">{v > 0 ? `R ${v}` : `L ${-v}`}</text>
            </g>
          ))}
          <line x1={ML} x2={ML + PW} y1={TY(0)} y2={TY(0)} stroke="var(--fl-axis)" strokeWidth={1.5} strokeDasharray="4 4" />

          {/* Golfer's own shots */}
          {ownShots.length > 0 && (
            <g key="own-shots-layer">
              {ownShots.map(([cx, cz], sIdx) => (
                <circle
                  key={`own-shot-${sIdx}`}
                  cx={TX(cx)}
                  cy={TY(cz)}
                  r={3.5}
                  fill="#c8c8c8"
                  fillOpacity={0.7}
                  stroke="var(--fl-bg)"
                  strokeWidth={1}
                />
              ))}
              <circle
                cx={TX(ownAvgCarry)}
                cy={TY(ownAvgSide)}
                r={5.5}
                fill="none"
                stroke="#f8f8f8"
                strokeWidth={2}
              />
              <circle
                cx={TX(ownAvgCarry)}
                cy={TY(ownAvgSide)}
                r={2}
                fill="#f8f8f8"
              />
            </g>
          )}

          {/* Simulated head dispersion & ellipses */}
          {order.map(({ h, rec, slot, i }) => {
            const e1 = h.ellipses?.one_sigma;
            const e2 = h.ellipses?.two_sigma;
            const cx = TX(h.summary.carry.mean);
            const cy = TY(h.summary.side?.mean ?? e1?.cz ?? 0);
            const el = (e: Ellipse, fill: number, sw: number, dash?: string) => (
              <ellipse
                cx={TX(e.cx)}
                cy={TY(e.cz)}
                rx={e.rx * ts}
                ry={e.rz * ts}
                transform={`rotate(${e.angle_deg} ${TX(e.cx)} ${TY(e.cz)})`}
                fill={col(slot)}
                fillOpacity={fill}
                stroke={col(slot)}
                strokeWidth={sw}
                strokeDasharray={dash}
              />
            );
            return (
              <g key={`t${h.head}-${i}`} opacity={rec ? 1 : 0.8}>
                {h.landing_pts?.map((p, pIdx) => (
                  <circle key={pIdx} cx={TX(p[0])} cy={TY(p[1])} r={1.8} fill={col(slot)} fillOpacity={rec ? 0.5 : 0.35} />
                ))}
                {e2 && el(e2, 0, rec ? 1.5 : 1, "5 3")}
                {e1 && el(e1, rec ? 0.16 : 0.06, rec ? 2.5 : 1.75, guessed ? "6 4" : undefined)}
                <circle cx={cx} cy={cy} r={rec ? 5 : 4} fill={col(slot)} stroke="var(--fl-bg)" strokeWidth={2} />
              </g>
            );
          })}

          {/* Gutter labels */}
          {topLabels.map((l, k) => {
            const ly = labelYs[k];
            const lx = ML + PW + 14;
            const dotCol = l.isOwn ? "#c8c8c8" : col(l.slot);
            return (
              <g key={`tg-${l.key}`}>
                <polyline points={`${l.ax},${l.ay} ${lx - 4},${l.ay} ${lx},${ly}`} fill="none" stroke="var(--fl-axis)" />
                <circle cx={lx + 6} cy={ly} r={4.5} fill={dotCol} />
                <text x={lx + 16} y={ly + 4} className={l.rec ? "strong" : l.isOwn ? "mut" : undefined}>
                  {l.name} · carry {f0(l.carry)} yd
                </text>
              </g>
            );
          })}

          <text x={ML + PW} y={H - 6} textAnchor="end" className="mut">
            {caption ?? (guessed
              ? "dashed = guessed carry · 1σ / 2σ · Estimated by Takomo's physics model, yards"
              : "solid = 1σ · dashed = 2σ · Estimated by Takomo's physics model, yards")}
          </text>
        </>
      )}
    </svg>
  );
}
