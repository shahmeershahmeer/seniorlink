"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Accessibility, ArrowRight, ShoppingBasket, Bell, Camera, CircleCheck, Clock, Clock3, HandHeart, IdCard, MapPin, ShieldCheck, Star } from "lucide-react";
import { TaskIcon, UrgencyDot } from "@/components/icons";
import BottomNav from "@/components/BottomNav";
import PhotoPicker from "@/components/PhotoPicker";
import ProfileGone from "@/components/ProfileGone";
import RemoveProfile from "@/components/RemoveProfile";
import ScamWatch, { ScamAlertBanner } from "@/components/ScamWatch";
import { ShoppingChecklist, VolunteerRideControls } from "@/components/TaskDetails";
import VolunteerHours from "@/components/VolunteerHours";
import { useScamAlerts } from "@/components/useScamAlerts";
import CommunityMap, { type MapPoint } from "@/components/Map";
import { Avatar, Card, StatusTracker, TopBar, VerifiedBadge } from "@/components/ui";
import { post, useAppState } from "@/components/useAppState";
import { driveMinutes } from "@/lib/eta";
import { clock12 } from "@/lib/meds";
import { URGENCY, dateLabel, distanceKm, firstName } from "@/lib/format";
import { cannotHelp } from "@/lib/matching";
import type { HelpRequest, Volunteer } from "@/lib/types";

export default function Page() {
  return (
    <Suspense>
      <VolunteerPage />
    </Suspense>
  );
}

function VolunteerPage() {
  const params = useSearchParams();
  const ME = params.get("id") ?? "sarah";
  const initialTab = params.get("tab");
  const [tab, setTab] = useState<"help" | "hours" | "safety">(initialTab === "hours" || initialTab === "safety" ? initialTab : "help");
  const [verifying, setVerifying] = useState(false);
  const { state, refresh } = useAppState();
  const scamAlerts = useScamAlerts(state, `/volunteer?id=${ME}&tab=safety`);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastError, setToastError] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const seenMatches = useRef<Set<string> | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  const me = state?.volunteers.find((v) => v.id === ME);

  const { forMe, myTasks, nearby, doneToday } = useMemo(() => {
    const reqs = state?.requests ?? [];
    const startOfDay = new Date().setHours(0, 0, 0, 0);
    return {
      forMe: reqs.filter((r) => r.status === "matched" && r.matchedVolunteerId === ME),
      myTasks: reqs.filter((r) => r.volunteerId === ME && (r.status === "accepted" || r.status === "in_progress")),
      nearby: reqs
        .filter((r) => r.status === "open" || (r.status === "matched" && r.matchedVolunteerId !== ME))
        .sort((a, b) => (me ? distanceKm(me, a) - distanceKm(me, b) : 0)),
      doneToday: reqs.filter((r) => r.volunteerId === ME && r.status === "completed" && (r.completedAt ?? 0) >= startOfDay),
    };
  }, [state, me, ME]);

  // Buzz + highlight when a brand-new request is matched to Sarah.
  useEffect(() => {
    if (!state) return;
    const ids = new Set(forMe.map((r) => r.id));
    if (seenMatches.current) {
      const fresh = [...ids].filter((id) => !seenMatches.current!.has(id));
      if (fresh.length) {
        setNewIds(new Set(fresh));
        navigator.vibrate?.([200, 100, 200]);
        setTimeout(() => setNewIds(new Set()), 6000);
      }
    }
    seenMatches.current = ids;
  }, [state, forMe]);

  async function act(
    r: HelpRequest,
    action: "accept" | "start" | "pickup" | "complete",
    extra: { hours?: number; receiptTotal?: number } = {},
  ) {
    const { hours } = extra;
    setBusy(r.id + action);
    const res = await post<{ ok: boolean; error?: string }>(`/api/requests/${r.id}`, { action, volunteerId: ME, ...extra });
    await refresh();
    setBusy(null);
    setToastError(!res.ok);
    if (!res.ok) {
      setToast(res.error ?? "That didn't work. Please try again.");
      setTimeout(() => setToast(null), 4000);
      return;
    }
    if (action === "complete") {
      setToast(`Thank you, ${firstName(me!.name)}! ${hours} h added to your hours log. ${firstName(r.seniorName)} and their family have been notified.`);
      setTimeout(() => setToast(null), 4000);
    }
  }

  const points: MapPoint[] = useMemo(() => {
    if (!state || !me) return [];
    return [
      ...state.requests
        .filter((r) => r.status === "open" || r.status === "matched")
        .map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, kind: "request" as const, label: `${r.title} — ${r.seniorArea}` })),
      ...state.volunteers
        .filter((v) => v.id !== ME)
        .map((v) => ({ id: v.id, lat: v.lat, lng: v.lng, kind: "volunteer" as const, label: `${firstName(v.name)} · volunteer` })),
      { id: ME, lat: me.lat, lng: me.lng, kind: "you" as const, label: "You" },
    ];
  }, [state, me, ME]);

  async function verify() {
    setVerifying(true);
    await post("/api/verify", { volunteerId: ME });
    await refresh();
    setVerifying(false);
  }

  if (!state) return null;
  if (!me) return <ProfileGone />;

  return (
    <main className="pb-32">
      <TopBar title={`Hi, ${firstName(me.name)}`} subtitle={me.org} avatar={<Avatar initials={me.initials} color={me.color} photo={me.photo} />} />

      {toast && (
        <div
          role="status"
          className={`pop-in fixed inset-x-4 bottom-28 z-[1100] mx-auto max-w-lg rounded-3xl p-5 text-xl font-semibold text-white shadow-2xl ${toastError ? "bg-red-700" : "bg-emerald-700"}`}
        >
          {toast}
        </div>
      )}

      {tab === "safety" ? (
        <div className="px-4 pb-4 pt-5">
          <ScamWatch state={state} me={{ id: me.id, role: "volunteer", area: me.area }} alerts={scamAlerts} onRefresh={refresh} />
        </div>
      ) : tab === "hours" ? (
        <div className="px-4 pb-4 pt-5">
          <VolunteerHours state={state} me={me} onRefresh={refresh} />
        </div>
      ) : (
      <div className="flex flex-col gap-6 px-4 pt-5">
        <ScamAlertBanner alerts={scamAlerts.unseen} onOpen={() => setTab("safety")} />

        <Profile v={me} onRefresh={refresh} />

        {!me.verified && (
          <Card className="ring-2 ring-amber-400">
            <p className="flex items-center gap-2 text-xl font-semibold">
              <IdCard size={24} className="text-amber-600" aria-hidden /> One last step: verify your identity
            </p>
            <p className="mt-1 text-lg text-muted">
              Most seniors only accept verified volunteers. It takes about a minute.
            </p>
            <button
              onClick={verify}
              disabled={verifying}
              className="mt-4 w-full rounded-2xl bg-amber-500 py-4 text-xl font-semibold text-white disabled:opacity-70"
            >
              {verifying ? "Checking your ID…" : "Verify my ID"}
            </button>
            <p className="mt-2 text-center text-sm text-muted">Simulated for this prototype.</p>
          </Card>
        )}

        {forMe.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-2xl font-semibold">
              <Bell size={24} className="text-accent" aria-hidden /> New request for you
            </h2>
            <div className="flex flex-col gap-3">
              {forMe.map((r) => (
                <RequestCard
                  key={r.id}
                  r={r}
                  me={me}
                  fresh={newIds.has(r.id)}
                  featured
                  action={
                    <button
                      onClick={() => act(r, "accept")}
                      disabled={busy !== null}
                      className="w-full rounded-2xl bg-brand py-4 text-xl font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
                    >
                      {busy === r.id + "accept" ? "Accepting…" : "Accept request"}
                    </button>
                  }
                />
              ))}
            </div>
          </section>
        )}

        {myTasks.length > 0 && (
          <section>
            <h2 className="mb-3 text-2xl font-semibold">My tasks</h2>
            <div className="flex flex-col gap-3">
              {myTasks.map((r) => (
                <RequestCard
                  key={r.id}
                  r={r}
                  me={me}
                  showAddress
                  action={
                    <div className="flex flex-col gap-4">
                      <StatusTracker status={r.status} />
                      {(r.taskType === "groceries" || r.taskType === "pharmacy") && <ShoppingChecklist r={r} volunteerId={ME} onChange={refresh} />}
                      {r.taskType === "ride" && r.rideStage !== "picked_up" ? (
                        <VolunteerRideControls r={r} me={me} busy={busy !== null} onAct={(a) => act(r, a)} />
                      ) : r.status === "accepted" ? (
                        <button
                          onClick={() => act(r, "start")}
                          disabled={busy !== null}
                          className="w-full rounded-2xl bg-accent py-4 text-xl font-semibold text-white disabled:opacity-50"
                        >
                          {r.taskType === "groceries" ? "I'm heading to the store" : r.taskType === "pharmacy" ? "I'm heading to the pharmacy" : "I'm on my way"}
                        </button>
                      ) : (
                        <>
                          {r.taskType === "ride" && <VolunteerRideControls r={r} me={me} busy={busy !== null} onAct={(a) => act(r, a)} />}
                          <CompleteWithHours
                            disabled={busy !== null}
                            label={r.taskType === "ride" ? "Arrived: complete the ride" : undefined}
                            askReceipt={(r.taskType === "groceries" || r.taskType === "pharmacy") && r.payment !== "paid_online"}
                            onComplete={(h, total) => act(r, "complete", { hours: h, receiptTotal: total })}
                          />
                        </>
                      )}
                    </div>
                  }
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-1 text-2xl font-semibold">People near you need help</h2>
          <p className="mb-3 text-muted">Fredericton · {nearby.length} open requests</p>
          <CommunityMap points={points} center={[me.lat + 0.004, me.lng + 0.012]} zoom={13} onSelect={setHighlight} />
          <div className="mt-2 flex flex-wrap gap-4 text-sm font-semibold">
            <span className="inline-flex items-center gap-2"><UrgencyDot className="bg-red-600" /> Help needed</span>
            <span className="inline-flex items-center gap-2"><UrgencyDot className="bg-green-600" /> Volunteers</span>
            <span className="inline-flex items-center gap-2"><UrgencyDot className="bg-blue-600" /> You</span>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {nearby.map((r) => (
              <RequestCard
                key={r.id}
                r={r}
                me={me}
                fresh={highlight === r.id}
                action={(() => {
                  const reason = cannotHelp(r, me, state.seniors.find((s) => s.id === r.seniorId)?.verifiedOnly ?? true);
                  return reason ? (
                    <p className="rounded-2xl bg-sand px-4 py-3 text-base text-muted">{reason}</p>
                  ) : (
                    <button
                      onClick={() => act(r, "accept")}
                      disabled={busy !== null}
                      className="w-full rounded-2xl border-2 border-brand py-3 text-lg font-semibold text-brand hover:bg-brand-soft disabled:opacity-50"
                    >
                      {busy === r.id + "accept" ? "Accepting…" : "Accept request"}
                    </button>
                  );
                })()}
              />
            ))}
          </div>
        </section>

        {doneToday.length > 0 && (
          <section>
            <h2 className="mb-3 text-2xl font-semibold">Completed today</h2>
            <Card className="flex flex-col gap-3">
              {doneToday.map((r) => (
                <div key={r.id} className="flex items-center gap-3 text-lg">
                  <TaskIcon type={r.taskType} size={36} />
                  <span className="flex-1">
                    {r.title} for {firstName(r.seniorName)}
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                    {r.rating ? (
                      <>
                        <Star size={16} className="fill-amber-400 text-amber-400" aria-hidden /> {r.rating}
                      </>
                    ) : (
                      <CircleCheck size={20} aria-label="Completed" />
                    )}
                  </span>
                </div>
              ))}
            </Card>
          </section>
        )}
        <div className="pb-4">
          <RemoveProfile kind="volunteer" id={me.id} name={me.name} self />
        </div>
      </div>
      )}

      <BottomNav
        active={tab}
        onChange={(k) => {
          setTab(k);
          window.scrollTo({ top: 0 });
        }}
        items={[
          { key: "help", label: "Help nearby", icon: HandHeart, badge: forMe.length || undefined },
          { key: "hours", label: "Hours & credit", icon: Clock3 },
          { key: "safety", label: "Safety", icon: ShieldCheck, badge: scamAlerts.unseen.length || undefined },
        ]}
      />
    </main>
  );
}

function Profile({ v, onRefresh }: { v: Volunteer; onRefresh: () => void }) {
  const stats = [
    { n: v.tasksCompleted, label: "tasks done" },
    { n: v.seniorsHelped, label: "seniors helped" },
    { n: v.hours, label: "community hours" },
  ];
  return (
    <Card className="bg-gradient-to-br from-brand to-brand-dark text-white ring-0">
      <div className="flex items-center gap-4">
        <PhotoPicker
          className="relative shrink-0 rounded-full"
          onPhoto={async (url) => {
            await post("/api/profile", { kind: "volunteer", id: v.id, photo: url });
            onRefresh();
          }}
        >
          <Avatar initials={v.initials} color="#ffffff33" size={64} photo={v.photo} />
          <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-brand shadow" aria-label="Change photo">
            <Camera size={16} />
          </span>
        </PhotoPicker>
        <div>
          <p className="text-2xl font-semibold">{v.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <VerifiedBadge verified={v.verified} />
            <span className="inline-flex items-center gap-1 font-medium">
              <Star size={16} className="fill-amber-300 text-amber-300" aria-hidden /> {v.rating.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white/10 py-3">
            <p className="text-3xl font-semibold">{s.n}</p>
            <p className="text-sm opacity-90">{s.label}</p>
          </div>
        ))}
      </div>
      {v.badge && <p className="mt-4 text-lg font-semibold">{v.badge}</p>}
    </Card>
  );
}

function RequestCard({
  r,
  me,
  action,
  featured,
  fresh,
  showAddress,
}: {
  r: HelpRequest;
  me: Volunteer;
  action: React.ReactNode;
  featured?: boolean;
  fresh?: boolean;
  showAddress?: boolean;
}) {
  const km = distanceKm(me, r);
  return (
    <Card className={`flex flex-col gap-4 transition ${featured ? "ring-2 ring-brand" : ""} ${fresh ? "pop-in ring-4 ring-accent" : ""}`}>
      <div className="flex items-start gap-4">
        <TaskIcon type={r.taskType} size={56} />
        <div className="min-w-0 flex-1">
          <p className="text-xl font-semibold">
            {firstName(r.seniorName)} needs {r.title.toLowerCase().startsWith("ride") ? "a " : ""}
            {r.title[0].toLowerCase() + r.title.slice(1)}
          </p>
          <ul className="mt-2 space-y-1 text-lg [&>li]:flex [&>li]:items-center [&>li]:gap-2 [&_svg]:shrink-0 [&_svg]:text-muted">
            <li>
              <MapPin size={18} aria-hidden /> {km.toFixed(1)} km away · {showAddress ? r.location : r.seniorArea}
            </li>
            <li>
              <Clock size={18} aria-hidden /> {dateLabel(r.date)}, {r.timeLabel}
            </li>
            {r.destination && (
              <li>
                <ArrowRight size={18} aria-hidden /> {r.destination}
                {r.taskType === "ride" && r.destLat != null && r.destLng != null
                  ? ` · ~${driveMinutes(r, { lat: r.destLat, lng: r.destLng })} min drive`
                  : ""}
              </li>
            )}
            {r.taskType === "ride" && r.appointmentTime && (
              <li>
                <Clock size={18} aria-hidden /> Appointment {clock12(r.appointmentTime)}
                {r.roundTrip ? " · round trip" : " · one way"}
              </li>
            )}
            {r.taskType === "groceries" && (r.shoppingList?.length ?? 0) > 0 && (
              <li>
                <ShoppingBasket size={18} aria-hidden /> {r.shoppingList!.length} items
                {r.budget ? ` · up to $${r.budget}` : ""}
                {r.payment === "paid_online" ? " · prepaid" : ""}
              </li>
            )}
            {r.taskType === "pharmacy" && (r.shoppingList?.length ?? 0) > 0 && (
              <li>
                <ShoppingBasket size={18} aria-hidden /> {r.shoppingList!.length} item{r.shoppingList!.length === 1 ? "" : "s"}
                {(() => {
                  const rx = r.shoppingList!.filter((i) => i.kind === "prescription").length;
                  return rx ? ` · ${rx} prescription${rx === 1 ? "" : "s"}` : "";
                })()}
                {r.payment === "paid_online" ? " · already paid" : ""}
              </li>
            )}
            <li>
              <span className="flex w-[18px] justify-center">
                <UrgencyDot className={URGENCY[r.urgency].dot} />
              </span>
              {URGENCY[r.urgency].label}
            </li>
            {r.accessibility && (
              <li>
                <Accessibility size={18} aria-hidden /> {r.accessibility}
              </li>
            )}
          </ul>
          {r.details && <p className="mt-2 text-base text-muted">{r.details}</p>}
          {!showAddress && <p className="mt-2 text-sm text-muted">Exact address shared after you accept.</p>}
        </div>
      </div>
      {action}
    </Card>
  );
}

function CompleteWithHours({
  disabled,
  onComplete,
  label = "Mark as completed",
  askReceipt = false,
}: {
  disabled: boolean;
  onComplete: (hours: number, receiptTotal?: number) => void;
  label?: string;
  askReceipt?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const [hours, setHours] = useState(1);
  const [receipt, setReceipt] = useState("");
  if (!asking) {
    return (
      <button
        onClick={() => setAsking(true)}
        disabled={disabled}
        className="w-full rounded-2xl bg-emerald-700 py-4 text-xl font-semibold text-white disabled:opacity-50"
      >
        {label}
      </button>
    );
  }
  return (
    <div className="pop-in flex flex-col gap-3 rounded-2xl bg-emerald-50 p-4">
      <p className="text-lg font-semibold">How long did it take?</p>
      <div className="flex flex-wrap gap-2">
        {[0.5, 1, 1.5, 2, 3].map((h) => (
          <button
            key={h}
            onClick={() => setHours(h)}
            aria-pressed={hours === h}
            className={`rounded-2xl px-4 py-2.5 text-lg font-medium ${hours === h ? "bg-emerald-700 text-white" : "bg-white ring-2 ring-emerald-200"}`}
          >
            {h} h
          </button>
        ))}
      </div>
      <p className="text-sm text-muted">Include travel time. Hours are confirmed when the senior rates your help.</p>
      {askReceipt && (
        <label className="flex flex-col gap-1">
          <span className="text-lg font-semibold">Receipt total</span>
          <span className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 ring-2 ring-emerald-200 focus-within:ring-emerald-600">
            <span className="text-lg text-muted">$</span>
            <input
              value={receipt}
              onChange={(e) => setReceipt(e.target.value.replace(/[^\d.]/g, "").slice(0, 7))}
              inputMode="decimal"
              placeholder="0.00"
              className="min-w-0 flex-1 bg-transparent text-lg outline-none"
            />
          </span>
          <span className="text-sm text-muted">So the senior knows exactly what to pay you back. Keep the receipt with the bags.</span>
        </label>
      )}
      <button
        onClick={() => onComplete(hours, receipt ? Number(receipt) : undefined)}
        disabled={disabled}
        className="w-full rounded-2xl bg-emerald-700 py-4 text-xl font-semibold text-white disabled:opacity-50"
      >
        Complete and log {hours} h
      </button>
    </div>
  );
}
