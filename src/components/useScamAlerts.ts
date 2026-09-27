"use client";

import { useEffect, useMemo, useState } from "react";
import { askNotificationPermission, local, notify } from "@/components/notify";
import type { AppState, ScamCampaign } from "@/lib/types";

const ENABLED = "seniorlink:scam-alerts";
const seenKey = (c: ScamCampaign) => `seniorlink:scam-seen:${c.id}`;
const notifiedKey = (c: ScamCampaign) => `seniorlink:scam-notified:${c.id}`;

/**
 * Community scam alerts: a system notification the moment a campaign becomes an alert,
 * plus unseen alerts for an in-app banner.
 */
export function useScamAlerts(state: AppState | null, openUrl: string) {
  const [enabled, setEnabled] = useState(false);
  const [seenTick, setSeenTick] = useState(0);

  useEffect(() => setEnabled(local.get(ENABLED) === "on"), []);

  const campaigns = state?.campaigns;
  const alerts = useMemo(() => campaigns?.filter((c) => c.status === "alert") ?? [], [campaigns]);
  // seenTick forces a re-read of localStorage after dismissing
  void seenTick;
  const unseen = alerts.filter((c) => !local.get(seenKey(c)));

  useEffect(() => {
    if (!enabled) return;
    for (const c of alerts) {
      if (local.get(notifiedKey(c))) continue;
      local.set(notifiedKey(c), "1");
      notify(`Scam alert: ${c.alert.title}`, c.alert.summary, `scam-${c.id}`, openUrl);
    }
  }, [alerts, enabled, openUrl]);

  async function enable() {
    await askNotificationPermission();
    // Alerts that already exist are shown in the app; only new ones trigger a notification.
    for (const c of alerts) local.set(notifiedKey(c), "1");
    local.set(ENABLED, "on");
    setEnabled(true);
  }

  function markSeen(c: ScamCampaign) {
    local.set(seenKey(c), "1");
    setSeenTick((n) => n + 1);
  }

  return { alerts, unseen, enabled, enable, markSeen };
}
