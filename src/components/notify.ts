"use client";

export const local = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode: in-app banners still work */
    }
  },
};

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function askNotificationPermission() {
  if (notificationsSupported() && Notification.permission === "default") await Notification.requestPermission();
}

/** Shows a system notification (via the service worker when available, which Android requires). */
export async function notify(title: string, body: string, tag: string, url = "/") {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const options = { body, tag, icon: "/icons/icon-192-v2.png", badge: "/icons/icon-192-v2.png", data: { url } };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return reg.showNotification(title, options);
    new Notification(title, options);
  } catch {
    /* some browsers refuse outside a user gesture; the in-app banner still shows */
  }
}
