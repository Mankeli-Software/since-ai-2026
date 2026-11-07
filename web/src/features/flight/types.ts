import type { components } from "@/api/schema.gen";

export type TrajectoryPoint = [number, number, number, number];
export type LandingPoint = [number, number];
export type Ellipse = components["schemas"]["Ellipse"];
export type Ellipses = components["schemas"]["Ellipses"];
export type FlightSummary = components["schemas"]["FlightSummary"];
export type HeadFlight = components["schemas"]["HeadFlight"];
export type FlightResult = components["schemas"]["FlightResult"];
