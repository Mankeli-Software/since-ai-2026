import { useId, useMemo } from "react";
import type { Ellipse, FlightResult } from "./types";

export interface FlightSvgProps {
  data: FlightResult;
  /** Overrides `recommended` flags in the data. */
  recommendedSlug?: string;
  className?: string;
}

const NAMES: Record<string, string> = {
  "101-mkii": "101 MKII",
  "201-mkii": "201 MKII",
  "201t-mkii": "201T MKII",
  "301-cb": "301 CB",
  "301-mb": "301 MB",
};

// Colours: CSS vars (brand tokens / #42) with dataviz-palette fallbacks. Slot 0 = Tiger Orange (recommended).
// Slot 1 (recommended head) follows the brand token from src/styles/theme.css (#42 owns it).
const SLOT_LIGHT = ["var(--color-tiger-orange,#ff6e01)","#2a78d6", "#1baf7a", "#6250d6", "#e87ba4"];
const SLOT_DARK = ["#d95926", "#3987e5", "#199e70", "#9085e9", "#d55181"];
const css = SLOT_LIGHT.map((c, i) => `--fl-${i}:var(--color-flight-${i + 1},${c});`).join("");
const cssDark = SLOT_DARK.map((c, i) => `--fl-${i}:var(--color-flight-${i + 1},${c});`).join("");
const STYLE = `
.flight-svg{--fl-bg:var(--color-flight-surface,#fcfcfb);--fl-ink:var(--color-flight-ink,#0b0b0b);--fl-ink2:var(--color-flight-ink-2,#52514e);--fl-muted:#898781;--fl-grid:#e1e0d9;--fl-axis:#c3c2b7;${css}}
@media (prefers-color-scheme:dark){.flight-svg{--fl-bg:var(--color-flight-surface,#1a1a19);--fl-ink:var(--color-flight-ink,#f0efec);--fl-ink2:var(--color-flight-ink-2,#c3c2b7);--fl-grid:#2c2c2a;--fl-axis:#383835;${cssDark}}}
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

export function FlightSvg({ data, recommendedSlug, className }: FlightSvgProps) {
  const uid = useId();
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
    const xMax = Math.max(
      50,
      Math.ceil(Math.max(...items.map(({ h }) => h.summary.carry.mean + (h.ellipses ? ext(h.ellipses.two_sigma).hx : 8))) / 25) * 25,
    );
    const s = PW / xMax;
    const apexMax = Math.max(10, ...items.map(({ h }) => h.summary.apex));
    let lat = 20;
    for (const { h } of items) {
      const z = h.summary.side?.mean ?? h.ellipses?.two_sigma.cz ?? 0;
      const half = h.ellipses ? ext(h.ellipses.two_sigma).hz : (h.summary.side?.sd ?? 5) * 2;
      lat = Math.max(lat, Math.abs(z) + half + 2);
    }
    lat = Math.ceil(lat / 5) * 5;
    const sideH = Math.max(110, apexMax * 1.35 * s);
    // top view has its own x window (zoomed on the landing area), same scale on both axes
    const TOP_H = 280;
    const want = PW / (TOP_H / (2 * lat));
    const left = Math.min(...items.map(({ h }) => h.summary.carry.mean - (h.ellipses ? ext(h.ellipses.two_sigma).hx : 8)));
    const xMin = Math.max(0, Math.min(Math.ceil((xMax - want) / 25) * 25, Math.floor(left / 25) * 25));
    const ts = PW / (xMax - xMin);
    const topH = 2 * lat * ts;
    const sideY0 = 30;
    const topY0 = sideY0 + sideH + GAP + 14;
    const H = topY0 + topH + 30;
    // recommended last so it draws on top
    const order = [...items].sort((a, b) => Number(a.rec) - Number(b.rec));
    return { items, order, apexMax, xMax, xMin, ts, s, lat, sideH, topH, sideY0, topY0, H };
  }, [data, recommendedSlug]);

  const { items, order, apexMax, xMax, xMin, ts, s, lat, sideH, topH, sideY0, topY0, H } = L;
  const gy = sideY0 + sideH; // ground line in side view
  const X = (x: number) => ML + x * s;
  const SY = (y: number) => gy - y * s;
  const TX = (x: number) => ML + (x - xMin) * ts;
  const TY = (z: number) => topY0 + topH / 2 + z * ts;
  const col = (slot: number) => `var(--fl-${slot})`;

  const summary = items
    .map(({ name, h, rec }) => `${name}${rec ? " (recommended)" : ""}: carry ${f0(h.summary.carry.mean)} yd, apex ${f0(h.summary.apex)} yd`)
    .join("; ");

  // gutter labels, side view: sorted by apex (highest first); top view: de-collided at landing z
  const sideOrder = [...items].sort((a, b) => b.h.summary.apex - a.h.summary.apex);
  const topAnchor = items.map(({ h }) => TY(h.summary.side?.mean ?? h.ellipses?.one_sigma.cz ?? 0));
  const topLabelY = spread(topAnchor, 17, topY0 + 6, topY0 + topH - 6);

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
      <desc id={`${uid}d`}>{summary}. Simulated estimate.</desc>
      <style>{STYLE}</style>

      {/* SIDE VIEW */}
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
      {order.map(({ h, rec, slot }) => {
        const pts = h.trajectory?.map((p) => `${X(p[0]).toFixed(1)},${SY(p[1]).toFixed(1)}`).join(" ");
        const ax = h.trajectory?.reduce((m, p) => (p[1] > m[1] ? p : m))[0] ?? h.summary.carry.mean / 2;
        return (
          <g key={`s${h.head}`} opacity={rec ? 1 : 0.8}>
            {pts && <polyline points={pts} fill="none" stroke={col(slot)} strokeWidth={rec ? 3 : 2} strokeLinecap="round" strokeLinejoin="round" />}
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
      {sideOrder.map(({ h, name, rec, slot }, k) => (
        <g key={`sg${h.head}`}>
          <circle cx={ML + PW + 16} cy={sideY0 + 8 + k * 17} r={4.5} fill={col(slot)} />
          <text x={ML + PW + 26} y={sideY0 + 12 + k * 17} className={rec ? "strong" : undefined}>{name} · apex {f0(h.summary.apex)} yd</text>
        </g>
      ))}

      {/* TOP VIEW */}
      <text x={ML} y={topY0 - 8} className="mut">TOP VIEW (yd) · right of target is down</text>
      {ticks(xMax, 25).filter((v) => v >= xMin).map((v) => (
        <g key={`tx${v}`}>
          <line x1={TX(v)} x2={TX(v)} y1={topY0} y2={topY0 + topH} stroke="var(--fl-grid)" />
          <text x={TX(v)} y={topY0 + topH + 15} textAnchor="middle" className="mut">{v}</text>
        </g>
      ))}
      {[-20, -10, 10, 20].filter((v) => Math.abs(v) < lat).map((v) => (
        <g key={`ty${v}`}>
          <line x1={ML} x2={ML + PW} y1={TY(v)} y2={TY(v)} stroke="var(--fl-grid)" />
          <text x={ML - 6} y={TY(v) + 4} textAnchor="end" className="mut">{v > 0 ? `R ${v}` : `L ${-v}`}</text>
        </g>
      ))}
      <line x1={ML} x2={ML + PW} y1={TY(0)} y2={TY(0)} stroke="var(--fl-axis)" strokeWidth={1.5} strokeDasharray="4 4" />
      {order.map(({ h, rec, slot }) => {
        const e1 = h.ellipses?.one_sigma;
        const e2 = h.ellipses?.two_sigma;
        const cx = TX(h.summary.carry.mean);
        const cy = TY(h.summary.side?.mean ?? e1?.cz ?? 0);
        const el = (e: Ellipse, fill: number, sw: number, dash?: string) => (
          <ellipse
            cx={TX(e.cx)} cy={TY(e.cz)} rx={e.rx * ts} ry={e.rz * ts}
            transform={`rotate(${e.angle_deg} ${TX(e.cx)} ${TY(e.cz)})`}
            fill={col(slot)} fillOpacity={fill} stroke={col(slot)} strokeWidth={sw} strokeDasharray={dash}
          />
        );
        return (
          <g key={`t${h.head}`} opacity={rec ? 1 : 0.8}>
            {h.landing_pts?.map((p, i) => (
              <circle key={i} cx={TX(p[0])} cy={TY(p[1])} r={1.8} fill={col(slot)} fillOpacity={rec ? 0.5 : 0.35} />
            ))}
            {e2 && el(e2, 0, rec ? 1.5 : 1, "5 3")}
            {e1 && el(e1, rec ? 0.16 : 0.06, rec ? 2.5 : 1.75)}
            <circle cx={cx} cy={cy} r={rec ? 5 : 4} fill={col(slot)} stroke="var(--fl-bg)" strokeWidth={2} />
          </g>
        );
      })}
      {items.map(({ h, name, rec, slot }, k) => {
        const e = h.ellipses ? ext(h.ellipses.two_sigma).hx : 6;
        const ax = TX(h.summary.carry.mean + e) + 4;
        const ay = topAnchor[k];
        const ly = topLabelY[k];
        const lx = ML + PW + 14;
        return (
          <g key={`tg${h.head}`}>
            <polyline points={`${ax},${ay} ${lx - 4},${ay} ${lx},${ly}`} fill="none" stroke="var(--fl-axis)" />
            <circle cx={lx + 6} cy={ly} r={4.5} fill={col(slot)} />
            <text x={lx + 16} y={ly + 4} className={rec ? "strong" : undefined}>{name} · carry {f0(h.summary.carry.mean)} yd</text>
          </g>
        );
      })}
      <text x={ML + PW} y={H - 4} textAnchor="end" className="mut">solid = 1σ · dashed = 2σ · simulated estimate</text>
    </svg>
  );
}
