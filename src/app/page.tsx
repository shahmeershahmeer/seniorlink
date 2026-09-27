"use client";

import { ChevronRight, Heart, MapPin, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui";
import InstallPrompt from "@/components/InstallPrompt";
import { aiLabel } from "@/lib/format";
import RemoveProfile from "@/components/RemoveProfile";
import { post, useAppState } from "@/components/useAppState";

interface Row {
  kind: "senior" | "volunteer" | "family";
  id: string;
  href: string;
  name: string;
  detail: string;
  initials: string;
  color: string;
  photo?: string;
}

export default function Home() {
  const { state, refresh } = useAppState(3000);
  const [resetting, setResetting] = useState(false);
  const [managing, setManaging] = useState(false);

  async function reset() {
    setResetting(true);
    await post("/api/reset", {});
    await refresh();
    setResetting(false);
  }

  const groups: { title: string; blurb: string; rows: Row[] }[] = state
    ? [
        {
          title: "Seniors",
          blurb: "Ask for help in your own words",
          rows: state.seniors.map((s) => ({
            kind: "senior" as const,
            id: s.id,
            href: `/senior?id=${s.id}`,
            name: s.name,
            detail: s.area,
            initials: s.initials,
            color: s.color,
            photo: s.photo,
          })),
        },
        {
          title: "Volunteers",
          blurb: "Help neighbours nearby",
          rows: state.volunteers.map((v) => ({
            kind: "volunteer" as const,
            id: v.id,
            href: `/volunteer?id=${v.id}`,
            name: v.name,
            detail: `${v.verified ? "Verified" : "Verification pending"} · ${v.area}`,
            initials: v.initials,
            color: v.color,
            photo: v.photo,
          })),
        },
        {
          title: "Family",
          blurb: "See a loved one's activity, with permission",
          rows: state.family
            .filter((f) => f.status !== "revoked")
            .map((f) => {
              const senior = state.seniors.find((s) => s.id === f.seniorId);
              return {
                kind: "family" as const,
                id: f.id,
                href: `/family?id=${f.id}`,
                name: f.name,
                detail: `${f.relation} of ${senior?.firstName ?? "—"}${f.status === "pending" ? " · Awaiting approval" : ""}`,
                initials: f.initials,
                color: f.color,
                photo: f.photo,
              };
            }),
        },
      ]
    : [];

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-8 pt-10">
      <div className="mb-8">
        <img src="/icons/logo-mark.png" alt="SeniorLink logo" className="mb-4 h-20 w-20" />
        <h1 className="text-4xl font-semibold tracking-tight">SeniorLink</h1>
        <p className="mt-2 text-xl text-muted">We turn a neighbourhood into a support network.</p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-base font-medium text-brand">
          <MapPin size={18} /> Fredericton, New Brunswick
        </p>
      </div>

      <InstallPrompt />

      <Link
        href="/join"
        className="mb-8 flex items-center justify-center gap-3 rounded-3xl bg-brand py-5 text-2xl font-semibold text-white shadow-lg hover:bg-brand-dark active:scale-[0.99]"
      >
        <UserPlus size={26} /> Join SeniorLink
      </Link>

      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{managing ? "Manage profiles" : "Or continue as…"}</h2>
        <button
          onClick={() => setManaging(!managing)}
          aria-pressed={managing}
          className={`rounded-full px-4 py-2 text-base font-medium ${managing ? "bg-brand text-white" : "text-brand ring-2 ring-brand/30"}`}
        >
          {managing ? "Done" : "Manage profiles"}
        </button>
      </div>
      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g.title}>
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              {g.title} <span className="font-normal normal-case">· {g.blurb}</span>
            </p>
            <div className="flex flex-col gap-2">
              {g.rows.map((r) =>
                managing ? (
                  <div key={r.href} className="flex flex-wrap items-center gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                    <Avatar initials={r.initials} color={r.color} size={52} photo={r.photo} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xl font-semibold">{r.name}</p>
                      <p className="truncate text-base text-muted">{r.detail}</p>
                    </div>
                    <RemoveProfile kind={r.kind} id={r.id} name={r.name} compact onRemoved={refresh} />
                  </div>
                ) : (
                <Link
                  key={r.href}
                  href={r.href}
                  className="flex items-center gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:shadow-md hover:ring-brand/40 active:scale-[0.99]"
                >
                  <Avatar initials={r.initials} color={r.color} size={52} photo={r.photo} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xl font-semibold">{r.name}</p>
                    <p className="truncate text-base text-muted">{r.detail}</p>
                  </div>
                  <ChevronRight size={28} className="text-brand" aria-hidden />
                </Link>
                ),
              )}
            </div>
          </section>
        ))}
      </div>

      <Link
        href="/donate"
        className="mt-8 flex items-center gap-4 rounded-3xl bg-accent-soft p-5 ring-1 ring-accent/30 transition hover:ring-accent"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-white">
          <Heart size={26} className="fill-white" />
        </span>
        <span className="flex-1">
          <span className="block text-xl font-semibold">Support SeniorLink</span>
          <span className="block text-base text-muted">Fund gas for volunteers, winter help and scam-safety workshops.</span>
        </span>
        <ChevronRight size={28} className="text-accent" aria-hidden />
      </Link>

      <div className="mt-auto flex items-center justify-between gap-3 pt-10 text-sm text-muted">
        <Link href="/ai" className="rounded-full px-3 py-2 font-medium text-brand underline">
          AI activity · {aiLabel(state?.aiProvider)}
        </Link>
        <button onClick={reset} disabled={resetting} className="rounded-full border border-stone-300 px-4 py-2 font-semibold hover:bg-white">
          {resetting ? "Resetting…" : "Reset demo"}
        </button>
      </div>
    </main>
  );
}
