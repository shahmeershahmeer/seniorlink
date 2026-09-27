import { distanceKm } from "./format";
import type { HelpRequest, Volunteer } from "./types";

// Ride estimates. Straight-line distance × 1.35 approximates real roads; city driving
// averages ~35 km/h, highway legs (e.g. Oromocto → Fredericton) ~70 km/h, plus 2 minutes to park.

type Point = { lat: number; lng: number };

export function driveMinutes(a: Point, b: Point): number {
  const km = distanceKm(a, b) * 1.35;
  const speed = km > 10 ? 70 : 35;
  return Math.max(3, Math.round((km / speed) * 60 + 2));
}

function lerp(a: Point, b: Point, t: number): Point {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

export function clockIn(minutes: number, from = Date.now()): string {
  return new Date(from + minutes * 60_000).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
}

export interface RideStatus {
  phase: "waiting" | "accepted" | "to_pickup" | "picked_up" | "done";
  pickup: Point;
  dest: Point | null;
  driver: Point | null;
  toPickupMin: number | null; // remaining minutes until the driver arrives
  tripMin: number | null; // pickup → destination
  arrivalMin: number | null; // remaining minutes until arrival at the destination
}

/** Live ride progress, simulated from when the volunteer started driving / picked the senior up. */
export function rideStatus(r: HelpRequest, driver?: Volunteer, now = Date.now()): RideStatus {
  const pickup = { lat: r.lat, lng: r.lng };
  const dest = r.destLat != null && r.destLng != null ? { lat: r.destLat, lng: r.destLng } : null;
  const tripMin = dest ? driveMinutes(pickup, dest) : null;
  const home = driver ? { lat: driver.lat, lng: driver.lng } : null;
  const approachMin = home ? driveMinutes(home, pickup) : null;
  const base = { pickup, dest, tripMin };

  if (r.status === "completed") return { ...base, phase: "done", driver: dest, toPickupMin: null, arrivalMin: 0 };
  if (r.status === "open" || r.status === "matched" || r.status === "cancelled" || !home || approachMin == null) {
    return { ...base, phase: "waiting", driver: null, toPickupMin: null, arrivalMin: null };
  }
  if (r.status === "accepted") {
    return { ...base, phase: "accepted", driver: home, toPickupMin: approachMin, arrivalMin: tripMin != null ? approachMin + tripMin : null };
  }
  if (r.rideStage === "picked_up" && dest && tripMin != null) {
    const elapsed = (now - (r.pickedUpAt ?? now)) / 60_000;
    const left = Math.max(1, Math.round(tripMin - elapsed));
    return { ...base, phase: "picked_up", driver: lerp(pickup, dest, Math.min(0.95, elapsed / tripMin)), toPickupMin: 0, arrivalMin: left };
  }
  const elapsed = (now - (r.startedAt ?? now)) / 60_000;
  const left = Math.max(1, Math.round(approachMin - elapsed));
  return {
    ...base,
    phase: "to_pickup",
    driver: lerp(home, pickup, Math.min(0.95, elapsed / approachMin)),
    toPickupMin: left,
    arrivalMin: tripMin != null ? left + tripMin : null,
  };
}

/** Directions link that opens the phone's maps app. */
export function directionsUrl(from: Point, to: Point): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=driving`;
}
