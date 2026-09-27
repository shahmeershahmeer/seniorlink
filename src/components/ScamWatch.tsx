"use client";

import {
  Bell,
  CircleCheck,
  Mic,
  Network,
  Phone,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui";
import { post } from "@/components/useAppState";
import type { useScamAlerts } from "@/components/useScamAlerts";
import { useSpeech } from "@/components/useSpeech";
import { aiLabel, timeAgo } from "@/lib/format";
import { CATEGORY_LABEL, CHANNEL_LABEL, dailyCounts, formatPhone } from "@/lib/scams";
import type { AppState, ScamAnalysis, ScamCampaign, ScamChannel, ScamReport } from "@/lib/types";

export interface Reporter {
  id: string;
  role: ScamReport["reporterRole"];
  area: string;
}

type Alerts = ReturnType<typeof useScamAlerts>;

export default function ScamWatch({
  state,
  me,
  alerts,
  onRefresh,
}: {
  state: AppState;
  me: Reporter;
  alerts: Alerts;
  onRefresh: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const active = state.campaigns.filter((c) => c.status === "alert");
  const watching = state.campaigns.filter((c) => c.status === "watching");
  const week = dailyCounts(state.scamReports);
  const weekTotal = week.reduce((t, d) => t + d.count, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-3 text-4xl font-semibold leading-tight">
          <ShieldCheck size={36} className="text-brand" aria-hidden /> Scam Watch
        </h1>
        <p className="mt-2 text-lg text-muted">
          Neighbours report scams here. SeniorLink links related reports together and warns everyone when a scam is spreading.
        </p>
      </div>

      {checking ? (
        <ScamCheck state={state} me={me} onClose={() => setChecking(false)} onRefresh={onRefresh} />
      ) : (
        <button
          onClick={() => setChecking(true)}
          className="flex items-center justify-center gap-3 rounded-3xl bg-brand py-6 text-2xl font-semibold text-white shadow-lg hover:bg-brand-dark active:scale-[0.99]"
        >
          <ShieldQuestion size={30} /> Is this a scam? Check it
        </button>
      )}

      {!alerts.enabled && (
        <Card className="flex items-center gap-4">
          <Bell size={28} className="shrink-0 text-accent" aria-hidden />
          <p className="flex-1 text-lg">Get a notification when a new scam is spreading near you.</p>
          <button onClick={alerts.enable} className="rounded-2xl bg-accent px-4 py-3 text-lg font-semibold text-white">
            Turn on
          </button>
        </Card>
      )}

      <Card>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-lg font-semibold">Reports this week</p>
            <p className="text-muted">
              {weekTotal} reports · {active.length} active alert{active.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <TrendBars data={week} />
      </Card>

      <section>
        <h2 className="mb-3 text-2xl font-semibold">Active alerts</h2>
        {active.length === 0 ? (
          <Card>
            <p className="text-lg text-muted">No scams are spreading right now.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {active.map((c) => (
              <AlertCard key={c.id} c={c} state={state} me={me} onRefresh={onRefresh} onSeen={() => alerts.markSeen(c)} />
            ))}
          </div>
        )}
      </section>

      {watching.length > 0 && (
        <section>
          <h2 className="mb-1 text-2xl font-semibold">Being watched</h2>
          <p className="mb-3 text-muted">Linked reports that aren&apos;t widespread yet.</p>
          <div className="flex flex-col gap-3">
            {watching.map((c) => (
              <Card key={c.id}>
                <p className="text-lg font-semibold">{c.alert.title}</p>
                <p className="text-muted">
                  {c.reportIds.length} linked reports · last {timeAgo(c.lastSeen)} · {c.areas.join(", ")}
                </p>
                <Indicators c={c} />
                <p className="mt-2 text-sm text-muted">Linked by: {[...new Set(c.links.map((l) => l.reason))].join("; ")}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      <Card className="flex flex-col gap-3">
        <p className="text-xl font-semibold">Report it officially too</p>
        <p className="text-lg text-muted">
          If you lost money or shared banking details, call your bank first. Then report to the Canadian Anti-Fraud Centre.
        </p>
        <a href="tel:18884958501" className="flex items-center justify-center gap-2 rounded-2xl py-3 text-lg font-semibold text-brand ring-2 ring-brand">
          <Phone size={20} /> Anti-Fraud Centre 1-888-495-8501
        </a>
      </Card>
    </div>
  );
}

function TrendBars({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="mt-4 flex h-28 items-end gap-2" role="img" aria-label={`Reports per day: ${data.map((d) => `${d.label} ${d.count}`).join(", ")}`}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs font-medium text-muted">{d.count || ""}</span>
          <div
            className={`w-full rounded-t-lg ${i === data.length - 1 ? "bg-accent" : "bg-brand/70"}`}
            style={{ height: `${Math.max(4, (d.count / max) * 80)}px` }}
          />
          <span className="text-xs text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function Indicators({ c }: { c: ScamCampaign }) {
  const chips = [
    ...c.indicators.phones.map((p) => formatPhone(p)),
    ...c.indicators.domains,
    ...c.indicators.emails,
    ...c.indicators.payments.map((p) => `pays by ${p}`),
  ];
  if (!chips.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {chips.map((x) => (
        <span key={x} className="rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-900 ring-1 ring-red-200">
          {x}
        </span>
      ))}
    </div>
  );
}

function AlertCard({
  c,
  state,
  me,
  onRefresh,
  onSeen,
}: {
  c: ScamCampaign;
  state: AppState;
  me: Reporter;
  onRefresh: () => void;
  onSeen: () => void;
}) {
  const [showNetwork, setShowNetwork] = useState(false);
  const [sent, setSent] = useState<"" | "added" | "already">("");
  const reports = state.scamReports.filter((r) => c.reportIds.includes(r.id));

  async function same() {
    const res = await post<{ already?: boolean }>("/api/scams", { action: "same", campaignId: c.id, reporterId: me.id, reporterRole: me.role, area: me.area });
    setSent(res.already ? "already" : "added");
    onSeen();
    onRefresh();
  }

  return (
    <Card className="flex flex-col gap-3 border-l-8 border-red-600">
      <div className="flex items-start gap-3">
        <ShieldAlert size={28} className="mt-0.5 shrink-0 text-red-600" aria-hidden />
        <div className="flex-1">
          <p className="text-xl font-semibold leading-snug">{c.alert.title}</p>
          <p className="text-base text-muted">
            {c.reportIds.length} reports · last {timeAgo(c.lastSeen)} · {c.channels.map((ch) => CHANNEL_LABEL[ch]).join(", ")}
          </p>
        </div>
      </div>
      <p className="text-lg">{c.alert.summary}</p>
      <Indicators c={c} />

      <div>
        <p className="mb-1 font-semibold">How to spot it</p>
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {c.alert.howToSpot.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-1 font-semibold">What to do</p>
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {c.alert.whatToDo.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
      <p className="text-sm text-muted">Reported in {c.areas.join(", ")}</p>

      <div className="flex flex-wrap gap-2">
        {sent ? (
          <p className="flex items-center gap-2 text-lg font-medium text-emerald-800">
            <CircleCheck size={20} /> {sent === "already" ? "You've already reported this one. Thank you!" : "Thanks, your report was added."}
          </p>
        ) : (
          <button onClick={same} className="rounded-2xl bg-red-600 px-4 py-3 text-lg font-semibold text-white">
            I got this too
          </button>
        )}
        <button
          onClick={() => {
            setShowNetwork(!showNetwork);
            onSeen();
          }}
          className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-lg font-medium text-brand ring-2 ring-brand/40"
        >
          <Network size={20} /> {showNetwork ? "Hide links" : "How reports are linked"}
        </button>
      </div>
      {showNetwork && <ScamNetwork c={c} reports={reports} />}
    </Card>
  );
}

const LINK_STYLE = {
  indicator: { color: "#dc2626", label: "Same phone, website or email" },
  entity: { color: "#d97706", label: "Same organization impersonated" },
  text: { color: "#2563eb", label: "Similar wording" },
} as const;

/** The campaign's link graph: each dot is a report, each line is a reason two reports were connected. */
function ScamNetwork({ c, reports }: { c: ScamCampaign; reports: ScamReport[] }) {
  const W = 320;
  const H = 240;
  const R = 82;
  const pos = new Map(
    reports.map((r, i) => {
      const a = (i / reports.length) * Math.PI * 2 - Math.PI / 2;
      return [r.id, { x: W / 2 + R * Math.cos(a), y: H / 2 + R * Math.sin(a) }];
    }),
  );
  return (
    <div className="pop-in rounded-2xl bg-cream p-3">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-sm" role="img" aria-label={`${reports.length} linked reports`}>
          {c.links.map((l, i) => {
            const a = pos.get(l.a);
            const b = pos.get(l.b);
            if (!a || !b) return null;
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={LINK_STYLE[l.kind].color} strokeWidth={3} strokeOpacity={0.75} />;
          })}
          {reports.map((r) => {
            const p = pos.get(r.id)!;
            const above = p.y < H / 2;
            return (
              <g key={r.id}>
                <circle cx={p.x} cy={p.y} r={14} fill="#fff" stroke={r.lostMoney ? "#dc2626" : "#1b4530"} strokeWidth={3} />
                <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize="13" fontWeight="600" fill="#1c2526">
                  {CHANNEL_LABEL[r.channel][0]}
                </text>
                <text x={p.x} y={above ? p.y - 20 : p.y + 30} textAnchor="middle" fontSize="11" fill="#56615f">
                  {r.area.replace(" Fredericton", "")}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 flex flex-col gap-1 text-sm">
        {(Object.keys(LINK_STYLE) as (keyof typeof LINK_STYLE)[])
          .filter((k) => c.links.some((l) => l.kind === k))
          .map((k) => (
            <span key={k} className="inline-flex items-center gap-2">
              <span className="h-1 w-6 rounded" style={{ background: LINK_STYLE[k].color }} /> {LINK_STYLE[k].label}
            </span>
          ))}
        <span className="text-muted">Letters show how people were contacted (P = phone, T = text, E = email).</span>
      </div>
      <ul className="mt-2 list-disc pl-5 text-sm text-muted">
        {[...new Set(c.links.map((l) => l.reason))].map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  );
}

const VERDICT = {
  likely_scam: { label: "This looks like a scam", icon: ShieldAlert, className: "bg-red-700 text-white" },
  suspicious: { label: "Be careful: this is suspicious", icon: TriangleAlert, className: "bg-amber-500 text-white" },
  probably_safe: { label: "No clear signs of a scam", icon: ShieldCheck, className: "bg-emerald-700 text-white" },
} as const;

type CheckResult = {
  analysisId: string;
  analysis: ScamAnalysis;
  match: { campaignId: string; title: string; reports: number; reasons: string[] } | null;
};

function ScamCheck({ state, me, onClose, onRefresh }: { state: AppState; me: Reporter; onClose: () => void; onRefresh: () => void }) {
  const [channel, setChannel] = useState<ScamChannel>("phone");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [lostMoney, setLostMoney] = useState(false);
  const [sharedInfo, setSharedInfo] = useState(false);
  const [reported, setReported] = useState<ScamCampaign | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const speech = useSpeech("en-CA");

  async function check() {
    setBusy(true);
    setError(null);
    const res = await post<CheckResult & { error?: string }>("/api/scams", { action: "check", text, channel, area: me.area });
    setBusy(false);
    if (res.error) setError(res.error);
    else setResult(res);
  }

  async function report() {
    if (!result) return;
    setBusy(true);
    const res = await post<{ campaign: ScamCampaign | null; error?: string }>("/api/scams", {
      action: "report",
      analysisId: result.analysisId,
      reporterId: me.id,
      reporterRole: me.role,
      area: me.area,
      lostMoney,
      sharedInfo,
    });
    setBusy(false);
    if (res.error) setError(res.error);
    else {
      setReported(res.campaign);
      onRefresh();
    }
  }

  if (reported !== undefined) {
    return (
      <Card className="pop-in flex flex-col gap-3 ring-2 ring-emerald-400">
        <p className="flex items-center gap-2 text-2xl font-semibold text-emerald-800">
          <CircleCheck size={28} /> Thank you for reporting
        </p>
        {reported ? (
          <p className="text-lg">
            Your report was linked to <b className="font-semibold">{reported.alert.title}</b>, now {reported.reportIds.length} reports.
            {reported.status === "alert" ? " Neighbours are being alerted." : " We'll alert everyone if more people report it."}
          </p>
        ) : (
          <p className="text-lg">It&apos;s the first report like this. If others report something similar, we&apos;ll link them and warn everyone.</p>
        )}
        {(lostMoney || sharedInfo) && (
          <div className="rounded-2xl bg-red-50 p-4 text-lg text-red-900">
            <p className="font-semibold">Do this now:</p>
            <ul className="mt-1 list-disc pl-6">
              <li>Call your bank using the number on your card.</li>
              <li>Call the Anti-Fraud Centre: 1-888-495-8501.</li>
              <li>Tell someone you trust. It isn&apos;t your fault.</li>
            </ul>
          </div>
        )}
        <button onClick={onClose} className="rounded-2xl bg-brand py-4 text-xl font-semibold text-white">
          Done
        </button>
      </Card>
    );
  }

  if (result) {
    const v = VERDICT[result.analysis.verdict];
    const a = result.analysis;
    const ind = [
      ...a.indicators.phones.map(formatPhone),
      ...a.indicators.domains,
      ...a.indicators.emails,
      ...a.indicators.payments.map((p) => `asks for ${p}`),
    ];
    return (
      <Card className="pop-in flex flex-col gap-4 p-0">
        <div className={`flex items-center gap-3 rounded-t-3xl p-5 ${v.className}`}>
          <v.icon size={32} />
          <p className="text-2xl font-semibold leading-tight">{v.label}</p>
        </div>
        <div className="flex flex-col gap-4 px-5 pb-5">
          <div>
            <p className="text-xl font-semibold">{a.title}</p>
            <p className="text-base text-muted">
              {CATEGORY_LABEL[a.category]} · analysed by {aiLabel(a.source === "ai" ? state.aiProvider : "offline")}
            </p>
          </div>
          <p className="text-lg">{a.advice}</p>
          {a.tactics.length > 0 && (
            <div>
              <p className="mb-1 font-semibold">Warning signs we noticed</p>
              <div className="flex flex-wrap gap-2">
                {a.tactics.map((t) => (
                  <span key={t} className="rounded-full bg-amber-50 px-3 py-1 text-base text-amber-900 ring-1 ring-amber-200">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
          {ind.length > 0 && (
            <div>
              <p className="mb-1 font-semibold">Details we found</p>
              <div className="flex flex-wrap gap-2">
                {ind.map((x) => (
                  <span key={x} className="rounded-full bg-red-50 px-3 py-1 text-base text-red-900 ring-1 ring-red-200">
                    {x}
                  </span>
                ))}
              </div>
            </div>
          )}
          {result.match && (
            <div className="rounded-2xl bg-red-50 p-4 ring-1 ring-red-200">
              <p className="text-lg font-semibold text-red-900">
                Matches: {result.match.title} ({result.match.reports} reports)
              </p>
              <p className="text-base text-red-900">Linked because of {result.match.reasons.join("; ")}.</p>
            </div>
          )}

          {result.analysis.verdict !== "probably_safe" && (
            <>
              <div className="flex flex-col gap-2">
                <p className="font-semibold">Before you report</p>
                <Choice on={lostMoney} onClick={() => setLostMoney(!lostMoney)}>
                  I paid money
                </Choice>
                <Choice on={sharedInfo} onClick={() => setSharedInfo(!sharedInfo)}>
                  I shared personal or banking details
                </Choice>
              </div>
              <button onClick={report} disabled={busy} className="rounded-2xl bg-red-600 py-4 text-xl font-semibold text-white disabled:opacity-50">
                {busy ? "Reporting…" : "Report it to warn neighbours"}
              </button>
            </>
          )}
          {error && <p className="font-medium text-red-700">{error}</p>}
          <button onClick={onClose} className="py-2 text-lg font-medium text-muted underline">
            {result.analysis.verdict === "probably_safe" ? "Done" : "Not now"}
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="pop-in flex flex-col gap-4">
      <p className="text-2xl font-semibold">What happened?</p>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(CHANNEL_LABEL) as ScamChannel[]).map((ch) => (
          <Choice key={ch} on={channel === ch} onClick={() => setChannel(ch)}>
            {CHANNEL_LABEL[ch]}
          </Choice>
        ))}
      </div>
      <textarea
        rows={5}
        value={speech.listening ? speech.transcript : text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Describe the call, or paste the message. Include any phone number or website they used."
        className="w-full rounded-2xl border-2 border-sand bg-cream px-4 py-3 text-lg outline-none focus:border-brand"
      />
      {speech.supported && (
        <button
          type="button"
          onClick={() => (speech.listening ? speech.stop() : speech.start((t) => setText(t)))}
          className={`inline-flex items-center justify-center gap-2 rounded-2xl py-3 text-lg font-medium ${speech.listening ? "animate-pulse bg-accent text-white" : "ring-2 ring-sand"}`}
        >
          <Mic size={20} /> {speech.listening ? "Listening… tap when done" : "Say it instead"}
        </button>
      )}
      <p className="text-sm text-muted">
        Only the scam details are shared with neighbours. Your name and personal details are never shown.
      </p>
      {error && <p className="font-medium text-red-700">{error}</p>}
      <div className="flex gap-3">
        <button onClick={check} disabled={busy || text.trim().length < 8} className="flex-1 rounded-2xl bg-brand py-4 text-xl font-semibold text-white disabled:opacity-40">
          {busy ? "Checking…" : "Check it"}
        </button>
        <button onClick={onClose} className="rounded-2xl px-4 text-lg font-medium text-muted">
          Cancel
        </button>
      </div>
      {state.campaigns.length > 0 && <p className="text-sm text-muted">We compare it with {state.scamReports.length} reports from your neighbours.</p>}
    </Card>
  );
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-2xl px-4 py-2.5 text-left text-lg font-medium ${on ? "bg-brand text-white" : "bg-cream ring-2 ring-sand"}`}
    >
      {children}
    </button>
  );
}

/** Red banner shown on home screens while there are alerts the person hasn't opened yet. */
export function ScamAlertBanner({ alerts, onOpen }: { alerts: ScamCampaign[]; onOpen: () => void }) {
  if (!alerts.length) return null;
  const top = alerts[0];
  return (
    <button onClick={onOpen} className="pop-in flex w-full items-center gap-3 rounded-3xl bg-red-600 p-4 text-left text-white shadow-md">
      <ShieldAlert size={30} className="shrink-0" aria-hidden />
      <span className="flex-1">
        <span className="block text-lg font-semibold leading-snug">Scam alert: {top.alert.title}</span>
        <span className="block text-base opacity-90">
          {top.reportIds.length} neighbours reported it{alerts.length > 1 ? ` · ${alerts.length - 1} more alert${alerts.length > 2 ? "s" : ""}` : ""}
        </span>
      </span>
    </button>
  );
}
