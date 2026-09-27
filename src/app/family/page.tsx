"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  CircleCheck,
  Car,
  Handshake,
  Hourglass,
  Heart,
  Lock,
  Pill,
  ShieldAlert,
  NotebookPen,
  ThumbsUp,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { TaskIcon } from "@/components/icons";
import ProfileGone from "@/components/ProfileGone";
import RemoveProfile from "@/components/RemoveProfile";
import { RideTracker, ShoppingProgress } from "@/components/TaskDetails";
import { todaysDoses } from "@/lib/meds";
import Link from "next/link";
import type { ScamCampaign } from "@/lib/types";
import { Avatar, Card, StatusTracker, TopBar } from "@/components/ui";
import { post, useAppState } from "@/components/useAppState";
import { aiLabel, clockTime, familyTitle, dateLabel, isoDate, shortName, timeAgo } from "@/lib/format";
import type { ActivityEvent } from "@/lib/types";

const KIND_ICON: Record<ActivityEvent["kind"], LucideIcon> = {
  requested: NotebookPen,
  matched: Handshake,
  accepted: ThumbsUp,
  in_progress: Car,
  completed: CircleCheck,
  cancelled: X,
  privacy: Lock,
};

export default function Page() {
  return (
    <Suspense>
      <FamilyPage />
    </Suspense>
  );
}

function FamilyPage() {
  const familyId = useSearchParams().get("id") ?? "emily";
  const { state } = useAppState();
  const me = state?.family.find((f) => f.id === familyId);
  const SENIOR_ID = me?.seniorId ?? "";
  const senior = state?.seniors.find((s) => s.id === SENIOR_ID);
  const activity = useMemo(() => state?.activity.filter((a) => a.seniorId === SENIOR_ID) ?? [], [state, SENIOR_ID]);
  const active = useMemo(
    () => state?.requests.filter((r) => r.seniorId === SENIOR_ID && !["completed", "cancelled"].includes(r.status)) ?? [],
    [state, SENIOR_ID],
  );
  const [summary, setSummary] = useState<{ summary: string; source: string } | null>(null);
  const latestId = activity[0]?.id;
  const consent = me?.status === "approved";

  // Re-summarise whenever something new happens (not on every poll).
  useEffect(() => {
    if (!latestId || !consent) return;
    let cancelled = false;
    post<{ summary: string; source: string }>("/api/summary", { familyId }).then((s) => {
      if (!cancelled && s.summary) setSummary(s);
    });
    return () => {
      cancelled = true;
    };
  }, [latestId, consent, familyId]);

  if (!state) return null;
  if (!senior || !me) return <ProfileGone />;

  const title = `${me.callsThem}'s SeniorLink`;
  const bar = <TopBar title={title} subtitle={`${me.name} · ${me.relation}`} avatar={<Avatar initials={me.initials} color={me.color} photo={me.photo} />} />;

  if (me.status === "pending") {
    return (
      <main>
        {bar}
        <div className="px-4 pt-10">
          <Card className="text-center">
            <Hourglass size={40} strokeWidth={1.5} className="mx-auto text-muted" aria-hidden />
            <h1 className="mt-3 text-2xl font-semibold">Waiting for {senior.firstName} to approve</h1>
            <p className="mt-2 text-lg text-muted">
              We&apos;ve asked {senior.firstName} if you can see their SeniorLink activity. This page will update as soon as they say yes.
            </p>
          </Card>
          <div className="mt-6">
            <RemoveProfile kind="family" id={me.id} name={me.name} self />
          </div>
        </div>
      </main>
    );
  }

  if (!consent) {
    return (
      <main>
        {bar}
        <div className="px-4 pt-10">
          <Card className="text-center">
            <Lock size={40} strokeWidth={1.5} className="mx-auto text-muted" aria-hidden />
            <h1 className="mt-3 text-2xl font-semibold">{senior.firstName} isn&apos;t sharing their activity with you right now.</h1>
            <p className="mt-2 text-lg text-muted">
              SeniorLink only shows family members what a senior has chosen to share. They can turn sharing back on anytime.
            </p>
          </Card>
          <div className="mt-6">
            <RemoveProfile kind="family" id={me.id} name={me.name} self />
          </div>
        </div>
      </main>
    );
  }

  const today = isoDate(new Date());
  const todays = activity.filter((a) => isoDate(new Date(a.at)) === today);
  const earlier = activity.filter((a) => isoDate(new Date(a.at)) !== today);
  const daysQuiet = activity[0] ? Math.floor((Date.now() - activity[0].at) / 86_400_000) : 99;

  return (
    <main className="pb-12">
      {bar}
      <div className="flex flex-col gap-6 px-4 pt-5">
        <Card className="bg-gradient-to-br from-violet-50 to-white">
          <p className="text-sm font-semibold uppercase tracking-wide text-violet-800">This week, summarised by {aiLabel(state.aiProvider)}</p>
          <p className="mt-2 text-xl leading-relaxed">{summary ? summary.summary : "Putting together the week…"}</p>
        </Card>

        {/* Community check-in: compares app activity to her usual rhythm. Not a health signal. */}
        {activity.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl bg-sand px-4 py-3 text-lg">
            <span>{senior.firstName} just joined SeniorLink. Their activity will appear here.</span>
          </div>
        ) : daysQuiet >= 7 ? (
          <Card className="ring-2 ring-amber-400">
            <p className="flex items-center gap-2 text-xl font-semibold">
              <TriangleAlert size={22} className="text-amber-600" aria-hidden /> Unusual inactivity
            </p>
            <p className="mt-1 text-lg">
              No SeniorLink activity in {daysQuiet} days. They usually make 2–3 requests a week.
            </p>
            <button className="mt-3 w-full rounded-2xl bg-amber-500 py-3 text-lg font-semibold text-white">Would you like to check in?</button>
          </Card>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-lg text-emerald-900">
            <CircleCheck size={22} className="shrink-0" aria-hidden />
            <span>
              Usual activity — last active <b>{timeAgo(activity[0].at)}</b>
            </span>
          </div>
        )}

        <MedicineSummary
          doses={todaysDoses(
            state.medications.filter((m) => m.seniorId === senior.id),
            state.doseLogs.filter((l) => l.seniorId === senior.id),
          )}
        />

        <ScamTalkingPoints campaigns={state.campaigns.filter((c) => c.status === "alert")} callsThem={me.callsThem} />

        {active.length > 0 && (
          <section>
            <h2 className="mb-3 text-2xl font-semibold">Right now</h2>
            <div className="flex flex-col gap-3">
              {active.map((r) => {
                const vid = r.volunteerId ?? r.matchedVolunteerId;
                const vol = state.volunteers.find((v) => v.id === vid);
                return (
                  <Card key={r.id} className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <TaskIcon type={r.taskType} size={52} />
                      <div>
                        <p className="text-xl font-semibold">{familyTitle(r)}</p>
                        <p className="text-muted">
                          {dateLabel(r.date)} · {r.timeLabel}
                          {vol && ` · ${shortName(vol.name)}${vol.verified ? " (verified)" : ""}`}
                        </p>
                      </div>
                    </div>
                    <StatusTracker status={r.status} />
                    {r.taskType === "ride" && <RideTracker r={r} driver={r.volunteerId ? vol : undefined} viewer="family" />}
                    {r.taskType === "groceries" && <ShoppingProgress r={r} />}
                    {r.taskType === "pharmacy" && <ShoppingProgress r={r} hideNames />}
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-2xl font-semibold">Today&apos;s activity</h2>
          {todays.length === 0 ? (
            <Card>
              <p className="text-lg text-muted">Nothing yet today.</p>
            </Card>
          ) : (
            <Timeline events={todays} showClock />
          )}
        </section>

        {earlier.length > 0 && (
          <section>
            <h2 className="mb-3 text-xl font-semibold text-muted">Earlier this week</h2>
            <Timeline events={earlier} />
          </section>
        )}

        <Link href="/donate" className="flex items-center gap-3 rounded-3xl bg-accent-soft p-5 text-lg ring-1 ring-accent/30">
          <Heart size={24} className="shrink-0 fill-accent text-accent" aria-hidden />
          <span className="flex-1">Thank the volunteers helping {me.callsThem}: support SeniorLink</span>
        </Link>

        <p className="text-sm text-muted">
          {senior.firstName} chose to share task status with you. You can&apos;t see their messages, notes or exact addresses.
        </p>
        <RemoveProfile kind="family" id={me.id} name={me.name} self />
      </div>
    </main>
  );
}

function Timeline({ events, showClock }: { events: ActivityEvent[]; showClock?: boolean }) {
  return (
    <Card className="flex flex-col gap-0 py-2">
      {events.map((e, i) => (
        <div key={e.id} className={`flex items-start gap-4 py-3 ${i ? "border-t border-sand" : ""} ${i === 0 && showClock ? "pop-in" : ""}`}>
          <KindIcon kind={e.kind} />
          <div className="flex-1">
            <p className={`text-lg ${e.kind === "completed" ? "font-semibold text-emerald-800" : ""}`}>{e.message}</p>
            <p className="text-sm text-muted">{showClock ? clockTime(e.at) : timeAgo(e.at)}</p>
          </div>
        </div>
      ))}
    </Card>
  );
}

function KindIcon({ kind }: { kind: ActivityEvent["kind"] }) {
  const Icon = KIND_ICON[kind];
  return (
    <span
      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
        kind === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-sand text-muted"
      }`}
      aria-hidden
    >
      <Icon size={18} />
    </span>
  );
}

/** Adherence only: counts of taken / missed doses. Medicine names stay private to the senior. */
function MedicineSummary({ doses }: { doses: ReturnType<typeof todaysDoses> }) {
  if (doses.length === 0) return null;
  const taken = doses.filter((d) => d.status === "taken").length;
  const missed = doses.filter((d) => d.status === "missed").length;
  const upcoming = doses.filter((d) => d.status === "upcoming" || d.status === "due").length;
  return (
    <Card className={missed ? "ring-2 ring-red-300" : ""}>
      <p className="flex items-center gap-2 text-xl font-semibold">
        <Pill size={22} className="text-brand" aria-hidden /> Medicines today
      </p>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-sand">
        <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(taken / doses.length) * 100}%` }} />
      </div>
      <p className="mt-2 text-lg">
        <b className="font-semibold">{taken}</b> of {doses.length} doses taken
        {upcoming ? ` · ${upcoming} still to come` : ""}
      </p>
      {missed > 0 && (
        <p className="mt-1 text-lg font-medium text-red-800">
          {missed} missed dose{missed === 1 ? "" : "s"}. A gentle call might help.
        </p>
      )}
      <p className="mt-2 text-sm text-muted">You see whether doses were taken, not which medicines.</p>
    </Card>
  );
}

/** Active scam alerts, framed as things to talk through with the senior. */
function ScamTalkingPoints({ campaigns, callsThem }: { campaigns: ScamCampaign[]; callsThem: string }) {
  if (!campaigns.length) return null;
  return (
    <Card className="border-l-8 border-red-600">
      <p className="flex items-center gap-2 text-xl font-semibold">
        <ShieldAlert size={22} className="text-red-600" aria-hidden /> Scams going around Fredericton
      </p>
      <p className="mt-1 text-base text-muted">Worth a quick chat with {callsThem} this week.</p>
      <ul className="mt-3 flex flex-col gap-3">
        {campaigns.map((c) => (
          <li key={c.id}>
            <p className="text-lg font-semibold">{c.alert.title}</p>
            <p className="text-base">{c.alert.howToSpot[0]}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
