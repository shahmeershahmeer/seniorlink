"use client";

import { ArrowLeft, BadgeCheck, Check, Hourglass, MapPin, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { STATUS } from "@/lib/format";
import type { RequestStatus, Volunteer } from "@/lib/types";

/**
 * Sticky header with a back button. Pass `onBack` to handle back inside the page
 * (e.g. leave a sub-step); otherwise it returns to the member list.
 */
export function TopBar({
  title,
  subtitle,
  avatar,
  onBack,
}: {
  title: string;
  subtitle?: string;
  avatar?: React.ReactNode;
  onBack?: () => void;
}) {
  const router = useRouter();
  return (
    <header style={{ top: "env(safe-area-inset-top)" }} className="sticky top-0 z-[1000] flex items-center gap-3 border-b border-sand bg-cream/95 px-3 py-3 backdrop-blur">
      <button
        onClick={onBack ?? (() => router.push("/"))}
        className="flex h-12 items-center gap-1.5 rounded-full px-3 text-lg font-medium text-brand hover:bg-brand-soft"
        aria-label="Back"
      >
        <ArrowLeft size={22} strokeWidth={2} />
        Back
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-semibold leading-tight">{title}</p>
        {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
      </div>
      {avatar}
    </header>
  );
}

export function Avatar({ initials, color, size = 48, photo }: { initials: string; color: string; size?: number; photo?: string }) {
  if (photo) {
    return <img src={photo} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ background: color, width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials}
    </div>
  );
}

export function StatusPill({ status }: { status: RequestStatus }) {
  const s = STATUS[status];
  return <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${s.className}`}>{s.label}</span>;
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-medium text-emerald-800">
      <BadgeCheck size={16} /> Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-sm font-medium text-stone-600">
      <Hourglass size={14} /> Verification pending
    </span>
  );
}

export function Rating({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-medium">
      <Star size={16} className="fill-amber-400 text-amber-400" aria-hidden />
      {value.toFixed(1)}
    </span>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 ${className}`}>{children}</div>;
}

const STEPS: { key: RequestStatus; label: string }[] = [
  { key: "open", label: "Sent" },
  { key: "matched", label: "Matched" },
  { key: "accepted", label: "Accepted" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Done" },
];

export function StatusTracker({ status }: { status: RequestStatus }) {
  if (status === "cancelled") return <StatusPill status={status} />;
  const current = STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="flex items-start" aria-label={`Status: ${STATUS[status].label}`}>
      {STEPS.map((s, i) => {
        const done = i <= current;
        return (
          <li key={s.key} className="flex flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <div className={`h-1 flex-1 ${i === 0 ? "invisible" : done ? "bg-brand" : "bg-sand"}`} />
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  done ? "bg-brand text-white" : "bg-sand text-muted"
                } ${i === current && status !== "completed" ? "ring-4 ring-brand/25" : ""}`}
              >
                {done ? <Check size={16} strokeWidth={3} /> : i + 1}
              </div>
              <div className={`h-1 flex-1 ${i === STEPS.length - 1 ? "invisible" : i < current ? "bg-brand" : "bg-sand"}`} />
            </div>
            <span className={`mt-1 text-xs font-medium ${done ? "text-brand" : "text-muted"}`}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function VolunteerSummary({ v, km }: { v: Volunteer; km?: number }) {
  return (
    <div className="flex items-center gap-4">
      <Avatar initials={v.initials} color={v.color} size={64} photo={v.photo} />
      <div className="min-w-0">
        <p className="text-2xl font-semibold">{v.name.split(" ")[0]}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-base">
          <VerifiedBadge verified={v.verified} />
          <Rating value={v.rating} />
          {km !== undefined && (
            <span className="inline-flex items-center gap-1 text-muted">
              <MapPin size={16} aria-hidden /> {km.toFixed(1)} km
            </span>
          )}
        </div>
        {v.org && <p className="mt-1 text-sm text-muted">{v.org}</p>}
      </div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-4 py-2">
      <div className="flex-1">
        <p className="text-lg font-medium">{label}</p>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-9 w-16 shrink-0 rounded-full transition-colors ${checked ? "bg-brand" : "bg-stone-300"}`}
      >
        <span
          className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-all ${checked ? "left-8" : "left-1"}`}
        />
      </button>
    </label>
  );
}
