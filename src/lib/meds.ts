import { isoDate } from "./format";
import type { DoseLog, Medication } from "./types";

export type DoseStatus = "taken" | "skipped" | "due" | "missed" | "upcoming";

export interface ScheduledDose {
  med: Medication;
  time: string;
  status: DoseStatus;
  log?: DoseLog;
}

const DUE_WINDOW_MIN = 60; // a dose is "due" from its time until an hour later, then "missed"

export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function clock12(time: string): string {
  const mins = minutesOf(time);
  const h = Math.floor(mins / 60);
  const m = String(mins % 60).padStart(2, "0");
  return `${((h + 11) % 12) + 1}:${m} ${h < 12 ? "AM" : "PM"}`;
}

/** Today's doses for one senior, in time order, with a live status. */
export function todaysDoses(meds: Medication[], logs: DoseLog[], now = new Date()): ScheduledDose[] {
  const today = isoDate(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return meds
    .flatMap((med) =>
      med.times
        // A medicine added today only counts doses from when it was added.
        .filter((time) => {
          const added = new Date(med.addedAt);
          if (isoDate(added) !== today) return true;
          const log = logs.some((l) => l.medId === med.id && l.date === today && l.time === time);
          return log || minutesOf(time) >= added.getHours() * 60 + added.getMinutes();
        })
        .map((time) => {
        const log = logs.find((l) => l.medId === med.id && l.date === today && l.time === time);
        const t = minutesOf(time);
        const status: DoseStatus = log
          ? log.status
          : nowMin < t
            ? "upcoming"
            : nowMin < t + DUE_WINDOW_MIN
              ? "due"
              : "missed";
        return { med, time, status, log };
      }),
    )
    .sort((a, b) => minutesOf(a.time) - minutesOf(b.time));
}

/** Days of supply left, when we know the pill count. */
export function daysLeft(med: Medication): number | null {
  if (med.pillsLeft == null || med.times.length === 0) return null;
  return Math.floor(med.pillsLeft / med.times.length);
}

export const TIME_PRESETS = [
  { label: "Morning", time: "08:00" },
  { label: "Noon", time: "12:00" },
  { label: "Evening", time: "18:00" },
  { label: "Bedtime", time: "21:00" },
];
