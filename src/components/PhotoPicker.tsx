"use client";

import { Camera } from "lucide-react";
import { useRef, useState } from "react";
import { uploadPhoto } from "@/lib/image";

/** Opens the camera (on phones) or photo library, uploads, and reports the new URL. */
export default function PhotoPicker({
  onPhoto,
  label = "Add photo",
  className = "",
  children,
}: {
  onPhoto: (url: string) => void;
  label?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onPhoto(await uploadPhoto(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't use that photo");
    }
    setBusy(false);
  }

  return (
    <>
      <input ref={input} type="file" accept="image/*" onChange={pick} className="hidden" />
      <button type="button" onClick={() => input.current?.click()} disabled={busy} className={className}>
        {children ?? (
          <span className="inline-flex items-center gap-2">
            <Camera size={20} /> {busy ? "Uploading…" : label}
          </span>
        )}
      </button>
      {error && <p className="text-sm font-medium text-red-700">{error}</p>}
    </>
  );
}
