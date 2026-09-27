"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Bell, Check, ChevronRight, House, Lightbulb, Pill, ShieldCheck, Stethoscope, Mic, Phone, Siren, Star, Users, Volume2 } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import HealthChat from "@/components/HealthChat";
import { TaskIcon, UrgencyDot } from "@/components/icons";
import Medicines, { DoseRow } from "@/components/Medicines";
import PhotoPicker from "@/components/PhotoPicker";
import ProfileGone from "@/components/ProfileGone";
import RemoveProfile from "@/components/RemoveProfile";
import ScamWatch, { ScamAlertBanner } from "@/components/ScamWatch";
import { GroceryFields, PharmacyFields, RideFields, RideTracker, ShoppingProgress } from "@/components/TaskDetails";
import { useMedReminders } from "@/components/useMedReminders";
import { useScamAlerts } from "@/components/useScamAlerts";
import { Avatar, Card, StatusPill, StatusTracker, Toggle, TopBar, VolunteerSummary } from "@/components/ui";
import { post, useAppState } from "@/components/useAppState";
import { speak, useSpeech } from "@/components/useSpeech";
import { rideStatus } from "@/lib/eta";
import { TASKS, URGENCY, WINDOWS, addDays, aiLabel, dateLabel } from "@/lib/format";
import type { AppState, Draft, FamilyLink, HelpRequest, Medication, ParseResult, TaskType, TimeWindow, Urgency, Volunteer } from "@/lib/types";


type Stage =
  | { kind: "home" }
  | { kind: "thinking"; text: string }
  | { kind: "emergency"; text: string }
  | { kind: "confirm"; drafts: Draft[]; heard?: string; reply?: string; combine?: ParseResult["combine"]; source?: string }
  | { kind: "finding"; step: number }
  | { kind: "tracking"; ids: string[] };

const EXAMPLES = [
  "I need someone to pick up my prescription tomorrow afternoon.",
  "I need groceries and my prescription picked up today.",
  "J'ai besoin qu'on aille chercher mes médicaments demain après-midi.",
];

const HOME_CARDS: TaskType[] = ["groceries", "pharmacy", "ride", "snow"];

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <SeniorPage />
    </Suspense>
  );
}

function SeniorPage() {
  const params = useSearchParams();
  const SENIOR_ID = params.get("id") ?? "margaret";
  const initialTab = params.get("tab");
  const [tab, setTab] = useState<"help" | "meds" | "health" | "safety">(
    initialTab === "meds" || initialTab === "health" || initialTab === "safety" ? initialTab : "help",
  );
  const { state, refresh } = useAppState();
  const [stage, setStage] = useState<Stage>({ kind: "home" });
  const [lang, setLang] = useState<"en-CA" | "fr-CA">("en-CA");
  const [typed, setTyped] = useState("");
  const speech = useSpeech(lang);

  const senior = state?.seniors.find((s) => s.id === SENIOR_ID);
  const reminders = useMedReminders(state, senior);
  const scamAlerts = useScamAlerts(state, `/senior?id=${SENIOR_ID}&tab=safety`);
  const mine = useMemo(() => state?.requests.filter((r) => r.seniorId === SENIOR_ID) ?? [], [state, SENIOR_ID]);
  const familyLinks = state?.family.filter((f) => f.seniorId === SENIOR_ID) ?? [];
  const pendingFamily = familyLinks.filter((f) => f.status === "pending");
  const active = mine.filter((r) => r.status !== "completed" && r.status !== "cancelled");
  const past = mine.filter((r) => r.status === "completed");

  async function understand(text: string) {
    if (!text.trim()) return;
    setStage({ kind: "thinking", text });
    const result = await post<ParseResult>("/api/parse", { text, seniorId: SENIOR_ID });
    if (result.emergency) {
      setStage({ kind: "emergency", text });
      return;
    }
    setStage({ kind: "confirm", drafts: result.tasks, heard: text, reply: result.reply, combine: result.combine, source: result.source });
    speak(result.reply, lang);
  }

  function startForm(taskType: TaskType) {
    if (!senior) return;
    const draft: Draft = {
      taskType,
      title: { groceries: "Grocery pickup", pharmacy: "Prescription pickup", ride: "Ride", snow: "Snow shoveling", other: "Help at home" }[taskType],
      details: "",
      date: addDays(1),
      timeLabel: "Afternoon",
      timeWindow: "afternoon",
      location: senior.address,
      destination: null,
      urgency: "medium",
      accessibility: null,
      ...(taskType === "ride" && { title: "Ride to an appointment", appointmentTime: null, roundTrip: false }),
      ...(taskType === "groceries" && { shoppingList: [], substitutions: "similar" as const, payment: "pay_back" as const }),
      ...(taskType === "pharmacy" && { shoppingList: [], payment: "pay_back" as const, pharmacyAuthorized: false }),
    };
    setStage({ kind: "confirm", drafts: [draft] });
  }

  async function submit(drafts: Draft[]) {
    setStage({ kind: "finding", step: 0 });
    const steps = [700, 1400, 2100];
    const timers = steps.map((ms, i) => setTimeout(() => setStage({ kind: "finding", step: i + 1 }), ms));
    const [res] = await Promise.all([
      post<{ requests: HelpRequest[] }>("/api/requests", { drafts, seniorId: SENIOR_ID }),
      new Promise((r) => setTimeout(r, 2800)),
    ]);
    timers.forEach(clearTimeout);
    await refresh();
    setStage({ kind: "tracking", ids: res.requests.map((r) => r.id) });
  }

  async function setFamily(link: FamilyLink, status: FamilyLink["status"]) {
    await post("/api/family", { linkId: link.id, status });
    refresh();
  }

  async function setSetting(patch: { verifiedOnly?: boolean }) {
    await post("/api/settings", { seniorId: SENIOR_ID, ...patch });
    refresh();
  }

  if (!state) return <Loading />;
  if (!senior) return <ProfileGone />;

  return (
    <main className="pb-32">
      <TopBar
        title={`Hello, ${senior.firstName}`}
        subtitle={senior.area}
        onBack={
          tab !== "help" ? () => setTab("help") : stage.kind === "home" ? undefined : () => setStage({ kind: "home" })
        }
        avatar={<Avatar initials={senior.initials} color={senior.color} photo={senior.photo} />} />

      {tab !== "meds" && reminders.due.length > 0 && (
        <div className="px-4 pt-4">
          <p className="mb-2 flex items-center gap-2 text-lg font-semibold text-accent">
            <Bell size={20} className="animate-pulse" aria-hidden /> Time for your medicine
          </p>
          <div className="flex flex-col gap-2">
            {reminders.due.map((d) => (
              <DoseRow key={`${d.med.id}-${d.time}`} dose={d} onRefresh={refresh} compact />
            ))}
          </div>
        </div>
      )}

      {tab === "meds" && (
        <div className="px-4 pt-5">
          <Medicines state={state} senior={senior} reminders={reminders} onRefresh={refresh} />
        </div>
      )}

      {tab === "safety" && (
        <div className="px-4 pt-5">
          <ScamWatch state={state} me={{ id: senior.id, role: "senior", area: senior.area }} alerts={scamAlerts} onRefresh={refresh} />
        </div>
      )}

      {tab === "health" && (
        <div className="px-4 pt-5">
          <HealthChat senior={senior} onRefresh={refresh} provider={state.aiProvider} />
        </div>
      )}

      <div className="px-4 pt-5" hidden={tab !== "help"}>
        {stage.kind === "home" && (
          <div className="flex flex-col gap-6">
            {pendingFamily.map((f) => (
              <div key={f.id} className="pop-in rounded-3xl bg-violet-50 p-5 ring-2 ring-violet-300">
                <p className="text-xl font-semibold">
                  {f.name} ({f.relation}) would like to see your SeniorLink activity.
                </p>
                <p className="mt-1 text-base text-muted">They&apos;ll only see task status — never your messages or address.</p>
                <div className="mt-4 flex gap-3">
                  <button onClick={() => setFamily(f, "approved")} className="flex-1 rounded-2xl bg-brand py-3 text-lg font-semibold text-white">
                    Allow
                  </button>
                  <button onClick={() => setFamily(f, "revoked")} className="flex-1 rounded-2xl bg-white py-3 text-lg font-semibold ring-2 ring-sand">
                    Not now
                  </button>
                </div>
              </div>
            ))}

            <ScamAlertBanner alerts={scamAlerts.unseen} onOpen={() => setTab("safety")} />

            <h1 className="text-4xl font-semibold leading-tight">How can we help today?</h1>

            {/* Voice first */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => (speech.listening ? speech.stop() : speech.start(understand))}
                disabled={!speech.supported}
                className={`relative flex w-full items-center justify-center gap-4 rounded-3xl px-6 py-7 text-2xl font-semibold text-white shadow-lg transition active:scale-[0.99] disabled:opacity-60 ${
                  speech.listening ? "bg-accent" : "bg-brand hover:bg-brand-dark"
                }`}
              >
                <span className="relative flex h-14 w-14 items-center justify-center">
                  {speech.listening && (
                    <>
                      <span className="ripple absolute inset-0 rounded-full bg-white/40" />
                      <span className="ripple ripple-delay absolute inset-0 rounded-full bg-white/40" />
                    </>
                  )}
                  <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
                    <Mic size={28} strokeWidth={2} />
                  </span>
                </span>
                {speech.listening ? "Listening… tap when done" : "Tell us what you need"}
              </button>
              {speech.listening && speech.transcript && (
                <p className="w-full rounded-2xl bg-white p-4 text-xl italic">“{speech.transcript}”</p>
              )}
              {!speech.supported && <p className="text-sm text-muted">Voice works in Chrome or Safari. You can type below instead.</p>}
              {speech.error && <p className="text-sm text-red-700">Microphone problem ({speech.error}). You can type below instead.</p>}
              <div className="flex gap-2 text-sm" role="group" aria-label="Language">
                {(["en-CA", "fr-CA"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`rounded-full px-4 py-1.5 font-semibold ${lang === l ? "bg-ink text-white" : "bg-white text-muted ring-1 ring-black/10"}`}
                  >
                    {l === "en-CA" ? "English" : "Français"}
                  </button>
                ))}
              </div>
            </div>

            {/* Typing fallback */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                understand(typed);
              }}
              className="flex flex-col gap-2"
            >
              <label htmlFor="typed" className="text-lg font-semibold">
                Or type it
              </label>
              <div className="flex gap-2">
                <input
                  id="typed"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="e.g. I need a ride to the doctor on Thursday at 10"
                  className="min-w-0 flex-1 rounded-2xl border-2 border-sand bg-white px-4 py-3 text-lg outline-none focus:border-brand"
                />
                <button className="rounded-2xl bg-ink px-5 text-lg font-semibold text-white disabled:opacity-40" disabled={!typed.trim()}>
                  Go
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    type="button"
                    key={ex}
                    onClick={() => understand(ex)}
                    className="rounded-full bg-white px-3 py-1.5 text-left text-sm text-muted ring-1 ring-black/10 hover:ring-brand"
                  >
                    “{ex}”
                  </button>
                ))}
              </div>
            </form>

            {/* Task cards */}
            <div>
              <h2 className="mb-3 text-lg font-semibold">Or choose one</h2>
              <div className="grid grid-cols-2 gap-3">
                {HOME_CARDS.map((t) => (
                  <button
                    key={t}
                    onClick={() => startForm(t)}
                    className="flex flex-col items-center gap-2 rounded-3xl bg-white py-6 shadow-sm ring-1 ring-black/5 transition hover:ring-brand/50 active:scale-[0.98]"
                  >
                    <TaskIcon type={t} size={64} />
                    <span className="text-xl font-semibold">{TASKS[t].label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Requests */}
            {active.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-semibold">Your requests</h2>
                <div className="flex flex-col gap-3">
                  {active.map((r) => (
                    <button key={r.id} onClick={() => setStage({ kind: "tracking", ids: [r.id] })} className="text-left">
                      <Card className="flex items-center gap-4 hover:ring-brand/40">
                        <TaskIcon type={r.taskType} size={52} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xl font-semibold">{r.title}</p>
                          <p className="text-muted">
                            {dateLabel(r.date)} · {r.timeLabel}
                          </p>
                          {r.taskType === "ride" && <p className="text-base font-medium text-brand">{rideLine(r, state.volunteers)}</p>}
                          {(r.taskType === "groceries" || r.taskType === "pharmacy") && r.shoppingList?.length ? (
                            <p className="text-base text-muted">
                              {r.shoppingList.length} item{r.shoppingList.length === 1 ? "" : "s"}
                              {r.status === "in_progress" ? ` · ${r.shoppingList.filter((i) => i.status === "got").length} done` : ""}
                            </p>
                          ) : null}
                          <div className="mt-2">
                            <StatusPill status={r.status} />
                          </div>
                        </div>
                        <ChevronRight size={28} className="text-brand" aria-hidden />
                      </Card>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-semibold">Recent help</h2>
                <Card className="flex flex-col gap-3">
                  {past.slice(0, 4).map((r) => (
                    <div key={r.id} className="flex items-center gap-3">
                      <TaskIcon type={r.taskType} size={36} />
                      <span className="flex-1 text-lg">{r.title}</span>
                      <span className="text-sm font-semibold text-emerald-700">Done</span>
                    </div>
                  ))}
                </Card>
              </section>
            )}

            {/* Trust & privacy */}
            <section>
              <h2 className="mb-3 text-lg font-semibold">Safety & privacy</h2>
              <Card className="flex flex-col divide-y divide-sand">
                <div className="flex items-center gap-4 pb-3">
                  <Avatar initials={senior.initials} color={senior.color} photo={senior.photo} size={64} />
                  <div className="flex-1">
                    <p className="text-lg font-medium">Your photo</p>
                    <p className="text-sm text-muted">Helps volunteers recognise you at the door.</p>
                  </div>
                  <PhotoPicker
                    label={senior.photo ? "Change" : "Add"}
                    className="rounded-2xl px-4 py-2.5 text-lg font-medium text-brand ring-2 ring-brand/40"
                    onPhoto={async (url) => {
                      await post("/api/profile", { kind: "senior", id: senior.id, photo: url });
                      refresh();
                    }}
                  />
                </div>
                <Toggle
                  checked={senior.verifiedOnly}
                  onChange={(v) => setSetting({ verifiedOnly: v })}
                  label="Only verified volunteers"
                  hint="Only match me with people whose identity is checked."
                />
                {familyLinks
                  .filter((f) => f.status !== "pending")
                  .map((f) => (
                    <Toggle
                      key={f.id}
                      checked={f.status === "approved"}
                      onChange={(v) => setFamily(f, v ? "approved" : "revoked")}
                      label={`Share my activity with ${f.name.split(" ")[0]}`}
                      hint={`${f.relation} · sees task status only, never your messages.`}
                    />
                  ))}
              </Card>
              <p className="mt-3 text-sm text-muted">Volunteers only see your exact address after they accept.</p>
              <div className="mt-6">
                <RemoveProfile kind="senior" id={senior.id} name={senior.name} self />
              </div>
            </section>
          </div>
        )}

        {stage.kind === "thinking" && (
          <div className="flex flex-col items-center gap-6 pt-16 text-center">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-brand-soft border-t-brand" />
            <p className="text-2xl font-semibold">Understanding your request…</p>
            <p className="text-xl italic text-muted">“{stage.text}”</p>
          </div>
        )}

        {stage.kind === "emergency" && (
          <div className="pop-in flex flex-col gap-5 pt-6">
            <div className="rounded-3xl bg-red-700 p-6 text-white">
              <Siren size={40} strokeWidth={1.75} aria-hidden />
              <h1 className="mt-2 text-3xl font-semibold">This sounds like an emergency.</h1>
              <p className="mt-3 text-xl">
                Please call 911 now. SeniorLink helps with everyday errands and can&apos;t send emergency help.
              </p>
            </div>
            <a href="tel:911" className="rounded-3xl bg-white py-6 text-center text-3xl font-semibold text-red-700 shadow-lg ring-4 ring-red-700">
              <span className="inline-flex items-center gap-3">
                <Phone size={30} /> Call 911
              </span>
            </a>
            <button onClick={() => setStage({ kind: "home" })} className="py-3 text-lg font-semibold text-muted underline">
              It&apos;s not an emergency — go back
            </button>
          </div>
        )}

        {stage.kind === "confirm" && (
          <ConfirmView
            stage={stage}
            lang={lang}
            provider={state.aiProvider}
            meds={state.medications.filter((m) => m.seniorId === senior.id)}
            onChange={(drafts) => setStage({ ...stage, drafts })}
            onCombine={() => setStage({ ...stage, drafts: [combineDrafts(stage.drafts)], combine: undefined })}
            onDismissCombine={() => setStage({ ...stage, combine: undefined })}
            onSubmit={() => submit(stage.drafts)}
            onCancel={() => setStage({ kind: "home" })}
          />
        )}

        {stage.kind === "finding" && <FindingView step={stage.step} verifiedOnly={senior.verifiedOnly} />}

        {stage.kind === "tracking" && (
          <TrackingView
            requests={stage.ids.map((id) => state.requests.find((r) => r.id === id)).filter(Boolean) as HelpRequest[]}
            volunteers={state.volunteers}
            onBack={() => setStage({ kind: "home" })}
            onRefresh={refresh}
          />
        )}
      </div>

      <BottomNav
        active={tab}
        onChange={(k) => {
          setTab(k);
          window.scrollTo({ top: 0 });
        }}
        items={[
          { key: "help", label: "Home", icon: House },
          { key: "meds", label: "Medicines", icon: Pill, badge: reminders.due.length || undefined },
          { key: "health", label: "Health", icon: Stethoscope },
          { key: "safety", label: "Safety", icon: ShieldCheck, badge: scamAlerts.unseen.length || undefined },
        ]}
      />
    </main>
  );
}

function combineDrafts(drafts: Draft[]): Draft {
  const [first] = drafts;
  const urgencyRank: Urgency[] = ["low", "medium", "high"];
  return {
    ...first,
    title: drafts.map((d) => d.title).join(" + "),
    details: drafts.map((d) => d.details || d.title).join(" Also: "),
    destination: drafts.map((d) => d.destination).filter(Boolean).join(", ") || null,
    shoppingList: drafts.flatMap((d, n) => (d.shoppingList ?? []).map((i) => ({ ...i, id: `${n}-${i.id}` }))),
    urgency: urgencyRank[Math.max(...drafts.map((d) => urgencyRank.indexOf(d.urgency)))],
  };
}

function ConfirmView({
  stage,
  lang,
  provider,
  meds,
  onChange,
  onCombine,
  onDismissCombine,
  onSubmit,
  onCancel,
}: {
  stage: Extract<Stage, { kind: "confirm" }>;
  lang: string;
  provider?: AppState["aiProvider"];
  meds: Medication[];
  onChange: (d: Draft[]) => void;
  onCombine: () => void;
  onDismissCombine: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const fromAI = Boolean(stage.heard);
  const [error, setError] = useState<string | null>(null);
  const trySubmit = () => {
    for (const d of stage.drafts) {
      if (d.taskType === "ride" && !d.destination?.trim()) return setError("Please tell us where you're going.");
      if (d.taskType === "ride" && !d.location?.trim()) return setError("Please tell us where to pick you up.");
      if (d.taskType === "groceries" && !d.shoppingList?.length && !d.details.trim())
        return setError("Please add at least one item to your shopping list.");
      if (d.taskType === "pharmacy" && !d.shoppingList?.length && !d.details.trim())
        return setError("Please add what you need picked up from the pharmacy.");
    }
    setError(null);
    onSubmit();
  };
  return (
    <div className="pop-in flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-semibold">{fromAI ? "Here's what I understood" : "Tell us a bit more"}</h1>
        {fromAI && (
          <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand">
            Understood by {aiLabel(provider)}
          </p>
        )}
      </div>

      {stage.heard && <p className="text-lg italic text-muted">You said: “{stage.heard}”</p>}

      {stage.reply && (
        <button onClick={() => speak(stage.reply!, lang)} className="flex items-start gap-3 rounded-2xl bg-white p-4 text-left text-xl ring-1 ring-black/5">
          <Volume2 size={24} className="mt-1 shrink-0 text-brand" aria-hidden />
          <span>{stage.reply}</span>
        </button>
      )}

      {stage.combine?.suggest && stage.drafts.length > 1 && (
        <div className="rounded-3xl bg-accent-soft p-5 ring-2 ring-accent/40">
          <p className="flex gap-3 text-xl font-semibold">
            <Lightbulb size={24} className="mt-1 shrink-0 text-accent" aria-hidden />
            {stage.combine.message || "These can be done in one trip."}
          </p>
          <div className="mt-4 flex gap-3">
            <button onClick={onCombine} className="flex-1 rounded-2xl bg-accent py-3 text-lg font-semibold text-white">
              Combine into one trip
            </button>
            <button onClick={onDismissCombine} className="rounded-2xl bg-white px-4 py-3 text-lg font-semibold">
              Keep separate
            </button>
          </div>
        </div>
      )}

      {stage.drafts.map((d, i) => (
        <DraftEditor key={i} draft={d} meds={meds} onChange={(nd) => onChange(stage.drafts.map((x, j) => (j === i ? nd : x)))} />
      ))}

      {error && <p className="rounded-2xl bg-red-50 p-4 text-lg font-semibold text-red-800">{error}</p>}
      <button onClick={trySubmit} className="rounded-3xl bg-brand py-6 text-2xl font-semibold text-white shadow-lg hover:bg-brand-dark active:scale-[0.99]">
        Yes, send {stage.drafts.length > 1 ? `${stage.drafts.length} requests` : "it"}
      </button>
      <button onClick={onCancel} className="py-2 text-lg font-semibold text-muted underline">
        Start over
      </button>
    </div>
  );
}

function DraftEditor({ draft, onChange, meds }: { draft: Draft; onChange: (d: Draft) => void; meds: Medication[] }) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...draft, [k]: v });
  const input = "w-full rounded-2xl border-2 border-sand bg-cream px-4 py-3 text-lg outline-none focus:border-brand";

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <TaskIcon type={draft.taskType} size={56} />
        <input aria-label="What do you need?" value={draft.title} onChange={(e) => set("title", e.target.value)} className={`${input} text-2xl font-semibold`} />
      </div>

      <Field label="When">
        <div className="flex flex-wrap gap-2">
          {[addDays(0), addDays(1)].map((d) => (
            <Chip key={d} on={draft.date === d} onClick={() => set("date", d)}>
              {dateLabel(d)}
            </Chip>
          ))}
          <input type="date" value={draft.date} onChange={(e) => set("date", e.target.value)} className="rounded-2xl border-2 border-sand bg-cream px-3 py-2 text-lg" />
        </div>
      </Field>

      <Field label="Time">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(WINDOWS) as Exclude<TimeWindow, "anytime">[]).map((w) => (
            <Chip key={w} on={draft.timeWindow === w} onClick={() => onChange({ ...draft, timeWindow: w, timeLabel: WINDOWS[w] })}>
              {WINDOWS[w]}
            </Chip>
          ))}
        </div>
        {!Object.values(WINDOWS).includes(draft.timeLabel) && <p className="mt-2 text-lg font-semibold">{draft.timeLabel}</p>}
      </Field>

      {draft.taskType === "ride" ? (
        <RideFields draft={draft} onChange={onChange} />
      ) : (
        <Field label={draft.taskType === "groceries" || draft.taskType === "pharmacy" ? "Deliver to" : "Where"}>
          <input value={draft.location} onChange={(e) => set("location", e.target.value)} className={input} />
        </Field>
      )}

      {draft.taskType === "groceries" && <GroceryFields draft={draft} onChange={onChange} />}

      {draft.taskType === "pharmacy" && <PharmacyFields draft={draft} onChange={onChange} meds={meds} />}

      <Field label="Notes (optional)">
        <textarea rows={2} value={draft.details} onChange={(e) => set("details", e.target.value)} className={input} placeholder="Anything the helper should know" />
      </Field>

      <Field label="Accessibility needs (optional)">
        <input value={draft.accessibility ?? ""} onChange={(e) => set("accessibility", e.target.value || null)} className={input} placeholder="e.g. I use a walker" />
      </Field>

      <Field label="How soon?">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(URGENCY) as Urgency[]).map((u) => (
            <Chip key={u} on={draft.urgency === u} onClick={() => set("urgency", u)}>
              <span className="inline-flex items-center gap-2">
                <UrgencyDot className={URGENCY[u].dot} /> {u[0].toUpperCase() + u.slice(1)}
              </span>
            </Chip>
          ))}
        </div>
      </Field>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-base font-semibold text-muted">{label}</p>
      {children}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-2xl px-4 py-2.5 text-lg font-semibold transition ${on ? "bg-brand text-white" : "bg-cream text-ink ring-2 ring-sand"}`}
    >
      {children}
    </button>
  );
}

function FindingView({ step, verifiedOnly }: { step: number; verifiedOnly: boolean }) {
  const checks = ["Looking for neighbours within 5 km", "Checking who's available", verifiedOnly ? "Checking verification" : "Checking ratings"];
  return (
    <div className="flex flex-col items-center gap-8 pt-10 text-center">
      <div className="relative flex h-40 w-40 items-center justify-center">
        <span className="ripple absolute inset-0 rounded-full bg-brand/30" />
        <span className="ripple ripple-delay absolute inset-0 rounded-full bg-brand/30" />
        <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-brand text-white shadow-xl">
          <Users size={44} strokeWidth={1.75} />
        </span>
      </div>
      <h1 className="text-3xl font-semibold leading-tight">We&apos;re finding someone nearby who can help.</h1>
      <ul className="flex w-full flex-col gap-3 text-left text-xl">
        {checks.map((c, i) => (
          <li key={c} className={`flex items-center gap-3 transition-opacity ${i < step ? "opacity-100" : "opacity-30"}`}>
            <span className={`flex h-8 w-8 items-center justify-center rounded-full ${i < step ? "bg-brand text-white" : "bg-sand"}`}>{i < step ? <Check size={16} strokeWidth={3} /> : null}</span>
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrackingView({
  requests,
  volunteers,
  onBack,
  onRefresh,
}: {
  requests: HelpRequest[];
  volunteers: Volunteer[];
  onBack: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="pop-in flex flex-col gap-5">
      {requests.map((r) => {
        const volId = r.volunteerId ?? r.matchedVolunteerId;
        const vol = volunteers.find((v) => v.id === volId);
        return <TrackedRequest key={r.id} r={r} vol={vol} onRefresh={onRefresh} />;
      })}
      <button onClick={onBack} className="rounded-3xl bg-white py-5 text-xl font-semibold ring-2 ring-brand text-brand">
        Back to home
      </button>
    </div>
  );
}

function TrackedRequest({ r, vol, onRefresh }: { r: HelpRequest; vol?: Volunteer; onRefresh: () => void }) {
  const [rating, setRating] = useState(r.rating ?? 0);
  useEffect(() => setRating(r.rating ?? 0), [r.rating]);

  const headline: Record<HelpRequest["status"], string> = {
    open: r.taskType === "ride" ? "Waiting for a driver" : "We're still looking for a helper",
    matched: r.taskType === "ride" ? "Best available driver" : "Best available match",
    accepted: `${vol?.name.split(" ")[0]} is going to help you`,
    in_progress: `${vol?.name.split(" ")[0]} is on the way`,
    completed: "Request completed",
    cancelled: "Request cancelled",
  };

  async function rate(n: number) {
    setRating(n);
    await post(`/api/requests/${r.id}`, { action: "rate", rating: n });
    onRefresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center gap-4">
        <TaskIcon type={r.taskType} size={56} />
        <div>
          <p className="text-2xl font-semibold">{r.title}</p>
          <p className="text-lg text-muted">
            {dateLabel(r.date)} · {r.timeLabel}
          </p>
        </div>
      </Card>

      <Card className={r.status === "completed" ? "ring-2 ring-emerald-500" : ""}>
        <p className={`mb-4 text-2xl font-semibold ${r.status === "completed" ? "text-emerald-700" : "text-brand"}`}>{headline[r.status]}</p>
        {vol && <VolunteerSummary v={vol} km={r.matchKm} />}

        {r.matchExplanation && r.status !== "completed" && (
          <p className="mt-4 rounded-2xl bg-brand-soft p-4 text-lg">
            <span className="font-semibold">Why {vol?.name.split(" ")[0]}? </span>
            {r.matchExplanation}
          </p>
        )}
        {r.matchReasons && r.status === "matched" && (
          <div className="mt-3 flex flex-wrap gap-2">
            {r.matchReasons.map((reason) => (
              <span key={reason} className="rounded-full bg-cream px-3 py-1 text-sm font-semibold ring-1 ring-sand">
                {reason}
              </span>
            ))}
          </div>
        )}
        {r.status === "matched" && <p className="mt-4 text-lg text-muted">Waiting for {vol?.name.split(" ")[0]} to accept…</p>}
        {r.status === "open" && (
          <p className="text-lg text-muted">No one matched right away. We&apos;ve shared your request with all nearby volunteers.</p>
        )}

        <div className="mt-5">
          <StatusTracker status={r.status} />
        </div>

        {r.taskType === "ride" && (
          <div className="mt-5 border-t border-sand pt-5">
            <RideTracker r={r} driver={r.volunteerId ? vol : undefined} />
          </div>
        )}
        {(r.taskType === "groceries" || r.taskType === "pharmacy") && (r.shoppingList?.length ?? 0) > 0 && (
          <div className="mt-5 border-t border-sand pt-5">
            <ShoppingProgress r={r} />
          </div>
        )}

        {r.status === "completed" && vol && (
          <div className="mt-5 border-t border-sand pt-4">
            <p className="text-lg font-semibold">How was your help from {vol.name.split(" ")[0]}?</p>
            <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => rate(n)} aria-label={`${n} stars`} className="p-1">
                  <Star size={40} strokeWidth={1.5} className={n <= rating ? "fill-amber-400 text-amber-400" : "text-stone-300"} />
                </button>
              ))}
            </div>
            {rating > 0 && <p className="mt-2 text-lg text-emerald-700">Thank you! We&apos;ll let {vol.name.split(" ")[0]} know.</p>}
          </div>
        )}
      </Card>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-soft border-t-brand" />
    </div>
  );
}

/** One-line ride status for lists: "Waiting for a driver" / "Sarah arrives in 7 min". */
function rideLine(r: HelpRequest, volunteers: Volunteer[]) {
  const driver = volunteers.find((v) => v.id === r.volunteerId);
  const s = rideStatus(r, driver);
  const name = driver?.name.split(" ")[0];
  switch (s.phase) {
    case "waiting":
      return "Waiting for a driver";
    case "accepted":
      return `${name} will drive you`;
    case "to_pickup":
      return `${name} arrives in ${s.toPickupMin} min`;
    case "picked_up":
      return `Arriving in ${s.arrivalMin} min`;
    default:
      return "Arrived";
  }
}
