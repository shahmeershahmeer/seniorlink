import type { RequestStatus, TaskType, TimeWindow, Urgency } from "./types";

export const TASKS: Record<TaskType, { label: string; noun: string }> = {
  groceries: { label: "Groceries", noun: "grocery" },
  pharmacy: { label: "Pharmacy", noun: "pharmacy" },
  ride: { label: "Ride", noun: "ride" },
  snow: { label: "Snow help", noun: "snow-clearing" },
  other: { label: "Other help", noun: "helping" },
};

export const STATUS: Record<RequestStatus, { label: string; className: string }> = {
  open: { label: "Waiting for a volunteer", className: "bg-amber-100 text-amber-900" },
  matched: { label: "Match found", className: "bg-sky-100 text-sky-900" },
  accepted: { label: "Accepted", className: "bg-teal-100 text-teal-900" },
  in_progress: { label: "In progress", className: "bg-orange-100 text-orange-900" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-900" },
  cancelled: { label: "Cancelled", className: "bg-stone-200 text-stone-700" },
};

export const URGENCY: Record<Urgency, { label: string; dot: string }> = {
  low: { label: "Low urgency", dot: "bg-emerald-500" },
  medium: { label: "Medium urgency", dot: "bg-amber-400" },
  high: { label: "High urgency", dot: "bg-red-500" },
};

export const WINDOWS: Record<Exclude<TimeWindow, "anytime">, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

export function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

export function dateLabel(iso: string): string {
  if (iso === addDays(0)) return "Today";
  if (iso === addDays(1)) return "Tomorrow";
  if (iso === addDays(-1)) return "Yesterday";
  const d = new Date(`${iso}T12:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-CA", { weekday: "long", month: "short", day: "numeric" });
}

export function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function firstName(name: string): string {
  return name.split(" ")[0];
}

/** "Sarah Khan" -> "Sarah K." — what family members see. */
export function shortName(name: string): string {
  const [f, l] = name.split(" ");
  return l ? `${f} ${l[0]}.` : f;
}

/**
 * The title family members see. Pharmacy titles can reveal health conditions
 * ("Blood pressure prescription pickup"), so family only ever sees "Pharmacy pickup".
 */
export function familyTitle(r: { taskType: TaskType; title: string }): string {
  return r.taskType === "pharmacy" ? "Pharmacy pickup" : r.title;
}

/** Name of the AI service shown on screen next to AI-generated content. */
export function aiLabel(provider?: "snowflake" | "claude" | "offline"): string {
  return provider === "snowflake" ? "Snowflake Cortex AI" : provider === "claude" ? "Claude AI" : "SeniorLink AI (offline)";
}
