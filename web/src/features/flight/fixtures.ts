// DEMO FIXTURES ONLY: made-up but plausible Mikko-like 7-iron numbers (synthetic, L6) for the dev gallery
// until `POST /api/flight` lands. Not real golfer data.
import type { FlightResult, HeadFlight, TrajectoryPoint } from "./types";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function gauss(r: () => number) {
  return Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
}

function head(
  slug: string,
  seed: number,
  carry: number,
  apex: number,
  side: number,
  sdCarry: number,
  sdSide: number,
  recommended = false,
): HeadFlight {
  const r = rng(seed);
  const trajectory: TrajectoryPoint[] = [];
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    trajectory.push([carry * u, apex * Math.sin(Math.PI * u ** 0.92) ** 1.1, side * u * u, 5.2 * u]);
  }
  const landing_pts = Array.from({ length: 200 }, (): [number, number] => {
    const a = gauss(r);
    return [carry + sdCarry * a, side + sdSide * (0.3 * a + 0.95 * gauss(r))];
  });
  const e = (k: number) => ({ cx: carry, cz: side, rx: sdCarry * k, rz: sdSide * k, angle_deg: 8 });
  return {
    head: slug,
    recommended,
    trajectory,
    landing_pts,
    ellipses: { one_sigma: e(1), two_sigma: e(2) },
    summary: {
      carry: { mean: carry, p10: carry - 1.28 * sdCarry, p90: carry + 1.28 * sdCarry },
      side: { mean: side, sd: sdSide },
      apex,
    },
  };
}

export const flightTwoHeads: FlightResult = {
  per_head: [
    head("201-mkii", 11, 127, 27, 3, 5.5, 7.5),
    head("201t-mkii", 7, 131, 29, 2, 5, 6.5, true),
  ],
};

export const flightFiveHeads: FlightResult = {
  per_head: [
    head("101-mkii", 21, 123, 25, 5, 6, 9),
    head("201-mkii", 11, 127, 27, 3, 5.5, 7.5),
    head("201t-mkii", 7, 131, 29, 2, 5, 6.5, true),
    head("301-cb", 31, 134, 31, -1, 5.5, 6),
    head("301-mb", 41, 136, 33, -4, 6.5, 8),
  ],
};

/** Left-hander: slice curves LEFT in the target frame (negative z). Data is drawn as given, never mirrored. */
export const flightLeftHanded: FlightResult = {
  per_head: [head("201-mkii", 12, 127, 27, -9, 5.5, 8), head("201t-mkii", 8, 131, 29, -7, 5, 7, true)],
};
