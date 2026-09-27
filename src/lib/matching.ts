import { TASKS, distanceKm } from "./format";
import type { HelpRequest, Volunteer } from "./types";

/**
 * Why this volunteer can't take this request, or null if they can.
 * Same rules as matching: verified-only seniors, and rides need a vehicle.
 */
export function cannotHelp(
  req: Pick<HelpRequest, "taskType">,
  v: Pick<Volunteer, "verified" | "transport">,
  seniorWantsVerified: boolean,
): string | null {
  if (seniorWantsVerified && !v.verified) return "This senior only accepts verified volunteers. Complete your ID check first.";
  if (req.taskType === "ride" && v.transport !== "car" && v.transport !== "truck") return "Rides need a volunteer with a car.";
  return null;
}

export interface Match {
  volunteer: Volunteer;
  km: number;
  score: number;
  reasons: string[];
}

/**
 * Scores every eligible volunteer for a request (0–100ish):
 *   distance 30 · availability 25 · task experience 25 · rating/reliability 20
 * Hard filters: verified-only preference, vehicle needed for rides/snow.
 */
export function rankVolunteers(
  req: Pick<HelpRequest, "taskType" | "timeWindow" | "lat" | "lng">,
  volunteers: Volunteer[],
  opts: { verifiedOnly: boolean },
): Match[] {
  const needsVehicle = req.taskType === "ride";
  const matches: Match[] = [];

  for (const v of volunteers) {
    if (opts.verifiedOnly && !v.verified) continue;
    if (needsVehicle && v.transport !== "car" && v.transport !== "truck") continue;
    if (!v.skills.includes(req.taskType) && req.taskType !== "other") continue;

    const km = distanceKm(req, v);
    const available = req.timeWindow === "anytime" || v.availability.includes(req.timeWindow);
    const done = v.taskCounts[req.taskType] ?? 0;

    const score =
      Math.max(0, 30 - km * 4) +
      (available ? 25 : 0) +
      Math.min(done, 20) * 1.25 +
      (v.rating - 4) * 15 +
      Math.min(v.tasksCompleted, 50) / 10;

    const reasons = [`${km.toFixed(1)} km away`];
    if (available && req.timeWindow !== "anytime") reasons.push(`Available in the ${req.timeWindow}`);
    if (done > 0) reasons.push(`${done} ${TASKS[req.taskType].noun} tasks done`);
    if (v.verified) reasons.push("Verified");
    reasons.push(`${v.rating.toFixed(1)} rating`);

    matches.push({ volunteer: v, km, score, reasons });
  }

  return matches.sort((a, b) => b.score - a.score);
}
