"use client";

import { ArrowLeft, Printer } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAppState } from "@/components/useAppState";
import { TASKS } from "@/lib/format";
import { formatHours, isConfirmed, sumHours } from "@/lib/hours";
import { orgById } from "@/lib/orgs";
import type { TaskType } from "@/lib/types";

export default function Page() {
  return (
    <Suspense>
      <Report />
    </Suspense>
  );
}

/** Short, stable code an organization can quote back to verify the record. */
function verificationCode(text: string) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return `SL-${h.toString(36).toUpperCase().padStart(7, "0").slice(0, 7)}`;
}

function Report() {
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "sarah";
  const { state } = useAppState(10_000);
  const v = state?.volunteers.find((x) => x.id === id);
  if (!state || !v) return null;

  const logs = state.hourLogs.filter((l) => l.volunteerId === v.id && isConfirmed(l)).sort((a, b) => a.at - b.at);
  const total = sumHours(logs);
  const byType = new Map<TaskType, { count: number; hours: number }>();
  for (const l of logs) {
    const t = byType.get(l.taskType) ?? { count: 0, hours: 0 };
    byType.set(l.taskType, { count: t.count + 1, hours: t.hours + l.hours });
  }
  const orgs = state.orgLinks.filter((l) => l.volunteerId === v.id).map((l) => orgById(l.orgId)?.name).filter(Boolean);
  const fmt = (t: number) => new Date(t).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
  const code = verificationCode(`${v.id}|${total}|${logs.length}`);

  return (
    <main className="bg-white px-6 py-6 print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <button onClick={() => router.back()} className="-ml-3 flex h-12 items-center gap-1.5 rounded-full px-3 text-lg font-medium text-brand hover:bg-brand-soft">
          <ArrowLeft size={22} /> Back
        </button>
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-lg font-semibold text-white">
          <Printer size={20} /> Print or save PDF
        </button>
      </div>

      <header className="flex items-center gap-3 border-b-2 border-brand pb-4">
        <img src="/icons/logo-mark.png" alt="SeniorLink logo" className="h-14 w-14" />
        <div>
          <p className="text-2xl font-semibold">Volunteer Hours Record</p>
          <p className="text-muted">SeniorLink · Fredericton, New Brunswick</p>
        </div>
      </header>

      <section className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-base">
        <p className="text-muted">Volunteer</p>
        <p className="font-semibold">{v.name}</p>
        <p className="text-muted">Identity</p>
        <p className="font-semibold">{v.verified ? "Verified" : "Not yet verified"}</p>
        {v.org && (
          <>
            <p className="text-muted">Affiliation</p>
            <p className="font-semibold">{v.org}</p>
          </>
        )}
        {orgs.length > 0 && (
          <>
            <p className="text-muted">Shared with</p>
            <p className="font-semibold">{orgs.join(", ")}</p>
          </>
        )}
        <p className="text-muted">Period</p>
        <p className="font-semibold">{logs.length ? `${fmt(logs[0].at)} – ${fmt(logs[logs.length - 1].at)}` : "—"}</p>
        <p className="text-muted">Issued</p>
        <p className="font-semibold">{fmt(Date.now())}</p>
      </section>

      <section className="mt-6 grid grid-cols-3 gap-3 text-center">
        {[
          { n: formatHours(total), label: "confirmed hours" },
          { n: logs.length, label: "tasks completed" },
          { n: new Set(logs.map((l) => l.seniorFirstName)).size, label: "seniors helped" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-brand-soft py-4">
            <p className="text-3xl font-semibold text-brand">{s.n}</p>
            <p className="text-sm text-muted">{s.label}</p>
          </div>
        ))}
      </section>

      <section className="mt-6">
        <p className="mb-2 font-semibold">By type of help</p>
        <table className="w-full text-left text-base">
          <tbody>
            {[...byType.entries()].map(([t, x]) => (
              <tr key={t} className="border-b border-sand">
                <td className="py-2">{TASKS[t].label}</td>
                <td className="py-2 text-right">{x.count} tasks</td>
                <td className="py-2 text-right font-semibold">{formatHours(x.hours)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6">
        <p className="mb-2 font-semibold">Detailed log</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr className="border-b-2 border-sand">
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 font-medium">Task</th>
                <th className="py-2 font-medium">Senior</th>
                <th className="py-2 text-right font-medium">Hours</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-sand">
                  <td className="py-1.5 pr-2">{fmt(l.at)}</td>
                  <td className="py-1.5 pr-2">{l.title}</td>
                  <td className="py-1.5 pr-2">{l.seniorFirstName}</td>
                  <td className="py-1.5 text-right">{l.hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-8 border-t-2 border-brand pt-4 text-sm text-muted">
        <p>
          Verification code: <span className="font-semibold text-ink">{code}</span>
        </p>
        <p className="mt-1">
          Hours are counted once the senior confirms the help (or 48 hours pass with no issue reported). Seniors are identified
          by first name only to protect their privacy.
        </p>
      </footer>
    </main>
  );
}
