// PROVISIONAL: no flight model exists in backend/app/schemas yet. These types follow plan §3.6/§3.8
// (`POST /api/flight` -> FlightResult {per_head: [trajectory, landing_pts, ellipses, summary]}).
// Frame is the pack frame: x downrange, y up, z right (+ = right for everyone, never mirrored). Units: yards.
// When FIT lands the schema, replace this file with aliases of the generated types.

/** One trajectory sample [x, y, z, t]: downrange yd, height yd, lateral yd (+ right), seconds. */
export type TrajectoryPoint = [number, number, number, number];

/** Landing sample [x, z] in yards. */
export type LandingPoint = [number, number];

/** Dispersion ellipse in the top view. Radii in yd, angle in degrees from downrange (x) toward +z. */
export interface Ellipse {
  cx: number;
  cz: number;
  rx: number;
  rz: number;
  angle_deg: number;
}

export interface FlightSummary {
  carry: { mean: number; p10?: number; p90?: number };
  total?: number;
  side?: { mean: number; sd: number };
  apex: number;
  land_angle?: number;
  launch?: number;
  spin?: number;
}

export interface HeadFlight {
  /** Head slug, e.g. "201t-mkii". */
  head: string;
  /** Display name; falls back to a built-in name from the slug. */
  label?: string;
  recommended?: boolean;
  /** Median-shot trajectory, 30-60 points. */
  trajectory?: TrajectoryPoint[];
  landing_pts?: LandingPoint[];
  ellipses?: { one_sigma: Ellipse; two_sigma: Ellipse };
  summary: FlightSummary;
}

export interface FlightResult {
  per_head: HeadFlight[];
}
