"use client";

import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** "Add SeniorLink to your home screen": one tap on Android/Chrome, instructions on iPhone. */
export default function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem("seniorlink:install-dismissed") === "1";
    } catch {}
    if (standalone || dismissed) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIos(isIos);
    if (isIos) setHidden(false);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem("seniorlink:install-dismissed", "1");
    } catch {}
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    setHidden(true);
  }

  if (hidden) return null;

  return (
    <div className="pop-in mb-6 flex items-start gap-4 rounded-3xl bg-white p-5 shadow-sm ring-2 ring-brand/30">
      <img src="/icons/icon-192-v2.png" alt="" className="h-14 w-14 rounded-2xl" />
      <div className="flex-1">
        <p className="text-lg font-semibold">Get the SeniorLink app</p>
        {ios ? (
          <p className="mt-1 text-base text-muted">
            Tap <Share size={16} className="inline -mt-1" aria-label="Share" /> Share, then <b className="font-semibold">Add to Home Screen</b>.
          </p>
        ) : (
          <>
            <p className="mt-1 text-base text-muted">Add it to your home screen for quick access and medicine reminders.</p>
            <button onClick={install} className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-2.5 text-lg font-semibold text-white">
              <Download size={20} /> Install app
            </button>
          </>
        )}
      </div>
      <button onClick={dismiss} className="rounded-full p-1 text-muted" aria-label="Dismiss">
        <X size={20} />
      </button>
    </div>
  );
}
