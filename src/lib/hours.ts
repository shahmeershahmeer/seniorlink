import type { HourLog } from "./types";

const AUTO_CONFIRM_MS = 48 * 3_600_000;

/** Hours count once the senior confirms (rates) the help, or 48 h pass with no issue reported. */
export function isConfirmed(log: HourLog, now = Date.now()): boolean {
  return Boolean(log.confirmedAt) || now - log.at > AUTO_CONFIRM_MS;
}

export function sumHours(logs: HourLog[]): number {
  return logs.reduce((t, l) => t + l.hours, 0);
}

export function formatHours(h: number): string {
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}
