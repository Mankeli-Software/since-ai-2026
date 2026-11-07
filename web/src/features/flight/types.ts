import type { components } from "@/api/schema.gen";

export type TrajectoryPoint = [number, number, number, number] | number[];
export type LandingPoint = [number, number] | number[];
export type Ellipse = components["schemas"]["Ellipse"];
export type Ellipses = components["schemas"]["Ellipses"];
export type FlightSummary = components["schemas"]["FlightSummary"];
export type HeadFlight = Omit<components["schemas"]["HeadFlight"], "trajectory" | "landing_pts"> & {
  trajectory?: ([number, number, number, number] | number[])[];
  landing_pts?: ([number, number] | number[])[];
};
export type FlightResult = Omit<components["schemas"]["FlightResult"], "own_shots" | "per_head"> & {
  own_shots?: ([number, number] | number[])[];
  per_head: HeadFlight[];
};
