"use client";

import { Award, CircleCheck, Clock, Copy, FileText, Hourglass, Link2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { TaskIcon } from "@/components/icons";
import { Card } from "@/components/ui";
import { post } from "@/components/useAppState";
import { aiLabel } from "@/lib/format";
import { formatHours, isConfirmed, sumHours } from "@/lib/hours";
import { CREDIT_ORGS, MILESTONES, orgById, type CreditOrg } from "@/lib/orgs";
import type { AppState, Volunteer } from "@/lib/types";

export default function VolunteerHours({ state, me, onRefresh }: { state: AppState; me: Volunteer; onRefresh: () => void }) {
  const logs = useMemo(() => state.hourLogs.filter((l) => l.volunteerId === me.id).sort((a, b) => b.at - a.at), [state, me.id]);
  const confirmed = logs.filter((l) => isConfirmed(l));
  const pending = logs.filter((l) => !isConfirmed(l));
  const confirmedHours = sumHours(confirmed);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const thisMonth = sumHours(logs.filter((l) => l.at >= monthStart));
  const seniors = new Set(logs.map((l) => l.seniorFirstName)).size;

  const links = state.orgLinks.filter((l) => l.volunteerId === me.id);
  const connected = links.map((l) => ({ link: l, org: orgById(l.orgId)! })).filter((x) => x.org);
  const available = CREDIT_ORGS.filter((o) => !links.some((l) => l.orgId === o.id));

  return (
    <div className="flex flex-col gap-6">
      <Summary hours={confirmedHours} pendingHours={sumHours(pending)} tasks={logs.length} seniors={seniors} thisMonth={thisMonth} />

      <section>
        <h2 className="text-2xl font-semibold">Get credit for your hours</h2>
        <p className="mb-3 mt-1 text-muted">
          Connect your school or program and send them your confirmed hours in one tap.
        </p>
        <div className="flex flex-col gap-3">
          {connected.map(({ link, org }) => (
            <ConnectedOrg key={link.id} org={org} memberRef={link.memberRef} state={state} me={me} onRefresh={onRefresh} />
          ))}
          {available.map((org) => (
            <AvailableOrg key={org.id} org={org} me={me} onRefresh={onRefresh} />
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">Organization connections are simulated in this prototype.</p>
      </section>

      <ImpactStatement me={me} orgs={connected.map((c) => c.org)} hasHours={confirmed.length > 0} provider={state.aiProvider} />

      <HoursLog logs={logs} />

      <Link
        href={`/volunteer/report?id=${me.id}`}
        className="flex items-center justify-center gap-2 rounded-3xl bg-white py-5 text-xl font-semibold text-brand ring-2 ring-brand"
      >
        <FileText size={22} /> Print my hours report
      </Link>
    </div>
  );
}

function Summary({
  hours,
  pendingHours,
  tasks,
  seniors,
  thisMonth,
}: {
  hours: number;
  pendingHours: number;
  tasks: number;
  seniors: number;
  thisMonth: number;
}) {
  const next = MILESTONES.find((m) => m > hours);
  const prev = [...MILESTONES].reverse().find((m) => m <= hours) ?? 0;
  const pct = next ? ((hours - prev) / (next - prev)) * 100 : 100;
  const earned = MILESTONES.filter((m) => m <= hours);

  return (
    <Card className="bg-gradient-to-br from-brand to-brand-dark text-white ring-0">
      <p className="text-sm font-medium uppercase tracking-wide opacity-80">Confirmed volunteer hours</p>
      <p className="mt-1 text-6xl font-semibold tracking-tight">{formatHours(hours).replace(" h", "")}<span className="ml-1 text-2xl font-medium opacity-80">hours</span></p>
      {pendingHours > 0 && (
        <p className="mt-1 flex items-center gap-1.5 text-base opacity-90">
          <Hourglass size={16} /> + {formatHours(pendingHours)} awaiting senior confirmation
        </p>
      )}

      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        {[
          { n: tasks, label: "tasks" },
          { n: seniors, label: "seniors helped" },
          { n: formatHours(thisMonth), label: "this month" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white/10 py-3">
            <p className="text-2xl font-semibold">{s.n}</p>
            <p className="text-sm opacity-90">{s.label}</p>
          </div>
        ))}
      </div>

      {next && (
        <div className="mt-5">
          <div className="flex justify-between text-sm opacity-90">
            <span>Next milestone: {next} hours</span>
            <span>{formatHours(next - hours)} to go</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      {earned.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {earned.map((m) => (
            <span key={m} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-medium">
              <Award size={16} /> {m}-hour milestone
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

function OrgBadge({ org }: { org: CreditOrg }) {
  return (
    <span
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white"
      style={{ background: org.color }}
      aria-hidden
    >
      {org.short}
    </span>
  );
}

function ConnectedOrg({
  org,
  memberRef,
  state,
  me,
  onRefresh,
}: {
  org: CreditOrg;
  memberRef: string;
  state: AppState;
  me: Volunteer;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const subs = state.submissions.filter((s) => s.volunteerId === me.id && s.orgId === org.id);
  const sent = new Set(subs.flatMap((s) => s.logIds));
  const unsent = state.hourLogs.filter((l) => l.volunteerId === me.id && isConfirmed(l) && !sent.has(l.id));
  const approvedHours = sumHours(state.hourLogs.filter((l) => subs.some((s) => s.status === "approved" && s.logIds.includes(l.id))));

  async function submit() {
    setBusy(true);
    await post("/api/credit", { action: "submit", volunteerId: me.id, orgId: org.id });
    onRefresh();
    setBusy(false);
  }

  async function disconnect() {
    await post("/api/credit", { action: "disconnect", volunteerId: me.id, orgId: org.id });
    onRefresh();
  }

  return (
    <Card className="flex flex-col gap-4 ring-2 ring-brand/30">
      <div className="flex items-center gap-4">
        <OrgBadge org={org} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold leading-snug">{org.name}</p>
          <p className="text-muted">
            {org.program} · {memberRef}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-800">
          <Link2 size={14} /> Connected
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-2xl bg-cream py-3">
          <p className="text-2xl font-semibold">{formatHours(approvedHours)}</p>
          <p className="text-sm text-muted">credited</p>
        </div>
        <div className="rounded-2xl bg-cream py-3">
          <p className="text-2xl font-semibold">{formatHours(sumHours(unsent))}</p>
          <p className="text-sm text-muted">ready to send</p>
        </div>
      </div>

      <button
        onClick={submit}
        disabled={busy || unsent.length === 0}
        className="w-full rounded-2xl bg-brand py-4 text-lg font-semibold text-white hover:bg-brand-dark disabled:bg-stone-300"
      >
        {busy ? "Sending…" : unsent.length ? `Send ${formatHours(sumHours(unsent))} to ${org.short}` : "All confirmed hours sent"}
      </button>

      {subs.length > 0 && (
        <ul className="flex flex-col gap-2 border-t border-sand pt-3">
          {subs.map((s) => (
            <li key={s.id} className="flex items-center gap-3 text-base">
              {s.status === "approved" ? (
                <CircleCheck size={20} className="shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <Clock size={20} className="shrink-0 animate-pulse text-amber-600" aria-hidden />
              )}
              <span className="flex-1">
                {formatHours(s.hours)} ·{" "}
                {s.status === "approved" ? `Approved · ref ${s.reference}` : `Under review by ${org.short}`}
              </span>
              <span className="text-sm text-muted">
                {new Date(s.submittedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
              </span>
            </li>
          ))}
        </ul>
      )}

      <button onClick={disconnect} className="self-start text-sm text-muted underline">
        Disconnect {org.short}
      </button>
    </Card>
  );
}

function AvailableOrg({ org, me, onRefresh }: { org: CreditOrg; me: Volunteer; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [ref, setRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await post<{ error?: string }>("/api/credit", { action: "connect", volunteerId: me.id, orgId: org.id, memberRef: ref });
    setBusy(false);
    if (res.error) setError(res.error);
    else onRefresh();
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <OrgBadge org={org} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold leading-snug">{org.name}</p>
          <p className="text-muted">{org.program}</p>
        </div>
        {!open && (
          <button onClick={() => setOpen(true)} className="rounded-full border-2 border-brand px-4 py-2 font-semibold text-brand hover:bg-brand-soft">
            Connect
          </button>
        )}
      </div>
      {open && (
        <form onSubmit={connect} className="pop-in flex flex-col gap-3">
          <p className="text-base text-muted">{org.description}</p>
          <label className="text-base font-medium" htmlFor={`ref-${org.id}`}>
            {org.idLabel}
          </label>
          <input
            id={`ref-${org.id}`}
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder={org.idPlaceholder}
            className="w-full rounded-2xl border-2 border-sand bg-cream px-4 py-3 text-lg outline-none focus:border-brand"
            autoFocus
          />
          {error && <p className="font-medium text-red-700">{error}</p>}
          <div className="flex gap-3">
            <button disabled={busy} className="flex-1 rounded-2xl bg-brand py-3 text-lg font-semibold text-white disabled:opacity-60">
              {busy ? "Connecting…" : `Connect ${org.short}`}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-2xl px-4 py-3 text-lg font-medium text-muted">
              Cancel
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}

function ImpactStatement({
  me,
  orgs,
  hasHours,
  provider,
}: {
  me: Volunteer;
  orgs: CreditOrg[];
  hasHours: boolean;
  provider?: AppState["aiProvider"];
}) {
  const [orgId, setOrgId] = useState<string>("");
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function write() {
    setBusy(true);
    setCopied(false);
    const res = await post<{ statement: string }>("/api/impact", { volunteerId: me.id, orgId: orgId || undefined });
    setText(res.statement);
    setBusy(false);
  }

  async function copy() {
    if (!text) return;
    await navigator.clipboard?.writeText(text);
    setCopied(true);
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-xl font-semibold">
        <Sparkles size={22} className="text-violet-600" aria-hidden /> Impact statement
      </p>
      <p className="text-muted">
        {aiLabel(provider)} writes a short reflection from your confirmed hours, ready for a co-curricular record, scholarship or résumé.
      </p>
      {orgs.length > 0 && (
        <select
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          className="rounded-2xl border-2 border-sand bg-cream px-4 py-3 text-lg"
          aria-label="Write it for"
        >
          <option value="">For a résumé</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              For {o.short} {o.program}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={write}
        disabled={busy || !hasHours}
        className="rounded-2xl bg-violet-700 py-4 text-lg font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
      >
        {busy ? "Writing…" : text ? "Write it again" : "Write my impact statement"}
      </button>
      {text && (
        <div className="pop-in rounded-2xl bg-violet-50 p-4">
          <p className="text-lg leading-relaxed">{text}</p>
          <button onClick={copy} className="mt-3 inline-flex items-center gap-1.5 font-medium text-violet-800">
            <Copy size={16} /> {copied ? "Copied" : "Copy text"}
          </button>
        </div>
      )}
    </Card>
  );
}

function HoursLog({ logs }: { logs: AppState["hourLogs"] }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? logs : logs.slice(0, 12);
  const groups: { month: string; items: typeof logs }[] = [];
  for (const l of shown) {
    const month = new Date(l.at).toLocaleDateString("en-CA", { month: "long", year: "numeric" });
    const g = groups.find((x) => x.month === month);
    if (g) g.items.push(l);
    else groups.push({ month, items: [l] });
  }
  const monthTotal = (month: string) =>
    sumHours(logs.filter((l) => new Date(l.at).toLocaleDateString("en-CA", { month: "long", year: "numeric" }) === month));

  return (
    <section>
      <h2 className="mb-3 text-2xl font-semibold">Hours log</h2>
      {logs.length === 0 ? (
        <Card>
          <p className="text-lg text-muted">Your completed tasks will show up here with the hours you logged.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.month}>
              <p className="mb-2 flex justify-between text-sm font-medium uppercase tracking-wide text-muted">
                <span>{g.month}</span>
                <span>{formatHours(monthTotal(g.month))}</span>
              </p>
              <Card className="flex flex-col py-2">
                {g.items.map((l, i) => (
                  <div key={l.id} className={`flex items-center gap-3 py-3 ${i ? "border-t border-sand" : ""}`}>
                    <TaskIcon type={l.taskType} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-medium">{l.title}</p>
                      <p className="text-sm text-muted">
                        {new Date(l.at).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })} · for{" "}
                        {l.seniorFirstName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">{formatHours(l.hours)}</p>
                      {isConfirmed(l) ? (
                        <p className="text-xs font-medium text-emerald-700">Confirmed</p>
                      ) : (
                        <p className="text-xs font-medium text-amber-700">Awaiting senior</p>
                      )}
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          ))}
          {logs.length > 12 && (
            <button onClick={() => setShowAll(!showAll)} className="font-medium text-brand underline">
              {showAll ? "Show less" : `Show all ${logs.length} entries`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
