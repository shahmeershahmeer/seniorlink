"use client";

import { useEffect } from "react";

/** Registers the service worker once per page load. */
export default function PwaSetup() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* e.g. plain http on a phone — the app still works, just without install/notifications */
      });
    }
  }, []);
  return null;
}
