"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppState } from "@/lib/types";

/** Polls the server so every phone in the demo stays in sync. */
export function useAppState(intervalMs = 1500) {
  const [state, setState] = useState<AppState | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (res.ok) setState(await res.json());
    } catch {
      // offline for a moment — keep showing the last state
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, intervalMs);
    return () => clearInterval(t);
  }, [refresh, intervalMs]);

  return { state, refresh };
}

export async function post<T = unknown>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}
