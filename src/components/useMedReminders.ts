"use client";

import { useEffect, useMemo, useState } from "react";
import { askNotificationPermission, local as store, notificationsSupported, notify } from "@/components/notify";
import { speak } from "@/components/useSpeech";
import { isoDate } from "@/lib/format";
import { todaysDoses, type ScheduledDose } from "@/lib/meds";
import type { AppState, Senior } from "@/lib/types";

/**
 * Watches today's schedule. When a dose becomes due it fires one system notification,
 * reads the reminder aloud, and returns the due doses for an in-app banner.
 */
export function useMedReminders(state: AppState | null, senior: Senior | undefined) {
  const [enabled, setEnabled] = useState(false);
  const [tick, setTick] = useState(0);
  const key = senior ? `seniorlink:reminders:${senior.id}` : "";

  useEffect(() => {
    if (key) setEnabled(store.get(key) === "on");
  }, [key]);

  // Re-evaluate every 30 s so doses flip to "due" on time even without new server data.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const doses: ScheduledDose[] = useMemo(() => {
    if (!state || !senior) return [];
    return todaysDoses(
      state.medications.filter((m) => m.seniorId === senior.id),
      state.doseLogs.filter((l) => l.seniorId === senior.id),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, senior, tick]);

  const due = doses.filter((d) => d.status === "due");

  useEffect(() => {
    if (!enabled || !senior) return;
    const today = isoDate(new Date());
    for (const d of due) {
      const tag = `seniorlink:notified:${today}:${d.med.id}:${d.time}`;
      if (store.get(tag)) continue;
      store.set(tag, "1");
      const what = `${d.med.name}${d.med.dose ? ` ${d.med.dose}` : ""}`;
      notify(`Time for your ${d.med.name}`, `${what}${d.med.instructions ? ` · ${d.med.instructions}` : ""}`, tag, `/senior?id=${senior.id}&tab=meds`);
      speak(`${senior.firstName}, it's time to take your ${d.med.name}.`, "en-CA");
    }
  }, [due, enabled, senior]);

  async function enable() {
    await askNotificationPermission();
    store.set(key, "on");
    setEnabled(true);
  }

  function disable() {
    store.set(key, "off");
    setEnabled(false);
  }

  const permission = notificationsSupported() ? Notification.permission : "unsupported";
  return { doses, due, enabled, enable, disable, permission };
}
