"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { post } from "@/components/useAppState";

type Kind = "senior" | "volunteer" | "family";

const WHAT_HAPPENS: Record<Kind, string> = {
  senior: "Their requests, medicines and family connections will be deleted.",
  volunteer: "Any help they had accepted goes back to waiting for a new volunteer. Their hours log will be deleted.",
  family: "They will no longer see any activity.",
};

/** "Remove profile" with an inline confirmation step (no pop-up dialogs). */
export default function RemoveProfile({
  kind,
  id,
  name,
  self = false,
  onRemoved,
  compact = false,
}: {
  kind: Kind;
  id: string;
  name: string;
  /** Wording for removing your own profile. */
  self?: boolean;
  onRemoved?: () => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = name.split(" ")[0];

  async function remove() {
    setBusy(true);
    const res = await post<{ ok?: boolean; error?: string }>("/api/members/remove", { kind, id });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Couldn't remove this profile");
    if (onRemoved) onRemoved();
    else router.push("/");
  }

  if (!confirming) {
    return compact ? (
      <button
        onClick={(e) => {
          e.preventDefault();
          setConfirming(true);
        }}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-red-700 ring-2 ring-red-200 hover:bg-red-50"
        aria-label={`Remove ${name}`}
      >
        <Trash2 size={20} />
      </button>
    ) : (
      <button onClick={() => setConfirming(true)} className="flex items-center gap-2 self-start text-base font-medium text-red-700 underline">
        <Trash2 size={18} /> {self ? "Remove my profile" : `Remove ${first}'s profile`}
      </button>
    );
  }

  return (
    <div className="pop-in flex w-full flex-col gap-3 rounded-2xl bg-red-50 p-4 ring-1 ring-red-200" onClick={(e) => e.preventDefault()}>
      <p className="text-lg font-semibold text-red-900">{self ? "Remove your profile?" : `Remove ${name}?`}</p>
      <p className="text-base text-red-900">{WHAT_HAPPENS[kind]} This can&apos;t be undone.</p>
      {error && <p className="font-medium text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button onClick={remove} disabled={busy} className="flex-1 rounded-2xl bg-red-700 py-3 text-lg font-semibold text-white disabled:opacity-60">
          {busy ? "Removing…" : "Yes, remove"}
        </button>
        <button onClick={() => setConfirming(false)} className="flex-1 rounded-2xl bg-white py-3 text-lg font-medium ring-2 ring-sand">
          Keep
        </button>
      </div>
    </div>
  );
}
