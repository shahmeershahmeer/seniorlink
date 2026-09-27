"use client";

import { ArrowLeft, HandHeart, LifeBuoy, Users, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import PhotoPicker from "@/components/PhotoPicker";
import { Avatar, Card } from "@/components/ui";
import { post, useAppState } from "@/components/useAppState";
import { TASKS, WINDOWS } from "@/lib/format";
import { NEIGHBOURHOODS } from "@/lib/places";
import type { TaskType, TimeWindow, Volunteer } from "@/lib/types";

type Role = "senior" | "volunteer" | "family";

const ROLES: { role: Role; icon: LucideIcon; title: string; blurb: string }[] = [
  { role: "senior", icon: LifeBuoy, title: "I'd like some help", blurb: "Get help with errands, rides and more from trusted neighbours." },
  { role: "volunteer", icon: HandHeart, title: "I want to volunteer", blurb: "Help seniors near you, on your own schedule." },
  { role: "family", icon: Users, title: "I'm family", blurb: "Stay in the loop on a loved one's activity, with their permission." },
];

const TRANSPORT: { value: Volunteer["transport"]; label: string }[] = [
  { value: "car", label: "Car" },
  { value: "truck", label: "Truck" },
  { value: "walk", label: "On foot" },
  { value: "bus", label: "Bus" },
];

const input = "w-full rounded-2xl border-2 border-sand bg-white px-4 py-3 text-lg outline-none focus:border-brand";

export default function JoinPage() {
  const router = useRouter();
  const { state } = useAppState(5000);
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Shared + per-role fields
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [area, setArea] = useState<string>(NEIGHBOURHOODS[0].name);
  const [street, setStreet] = useState("");
  const [org, setOrg] = useState("");
  const [skills, setSkills] = useState<TaskType[]>([]);
  const [availability, setAvailability] = useState<TimeWindow[]>([]);
  const [transport, setTransport] = useState<Volunteer["transport"]>("car");
  const [seniorId, setSeniorId] = useState("");
  const [relation, setRelation] = useState("");
  const [callsThem, setCallsThem] = useState("");

  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return;
    setSaving(true);
    setError(null);
    const body =
      role === "senior"
        ? { role, name, area, street }
        : role === "volunteer"
          ? { role, name, area, org, skills, availability, transport }
          : { role, name, seniorId, relation, callsThem };
    const res = await post<{ role: Role; id: string } | { error: string }>("/api/members", body);
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    if (photo) await post("/api/profile", { kind: res.role, id: res.id, photo });
    router.push(`/${res.role}?id=${res.id}`);
  }

  return (
    <main className="px-5 pb-12 pt-6">
      <button
        onClick={() => (role ? setRole(null) : router.push("/"))}
        className="-ml-3 flex h-12 items-center gap-1.5 rounded-full px-3 text-lg font-medium text-brand hover:bg-brand-soft"
      >
        <ArrowLeft size={22} /> Back
      </button>
      <h1 className="mt-4 text-4xl font-semibold">Join SeniorLink</h1>
      <p className="mt-2 text-xl text-muted">Fredericton&apos;s neighbourhood support network.</p>

      {!role && (
        <div className="mt-8 flex flex-col gap-4">
          {ROLES.map((r) => (
            <button
              key={r.role}
              onClick={() => setRole(r.role)}
              className="flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-sm ring-1 ring-black/5 transition hover:ring-brand/50 active:scale-[0.99]"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                <r.icon size={30} strokeWidth={1.75} aria-hidden />
              </span>
              <span>
                <span className="block text-2xl font-semibold">{r.title}</span>
                <span className="block text-lg text-muted">{r.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {role && (
        <form onSubmit={submit} className="pop-in mt-6 flex flex-col gap-5">
          <button type="button" onClick={() => setRole(null)} className="self-start rounded-full bg-white px-4 py-2 font-semibold ring-1 ring-black/10">
            {ROLES.find((r) => r.role === role)!.title} · change
          </button>

          <Card className="flex flex-col gap-5">
            <Field label="Your full name">
              <input required value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="e.g. Robert Leblanc" autoFocus />
            </Field>

            <div className="flex items-center gap-4">
              <Avatar initials={name ? name.trim().split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() : "?"} color="#1b4530" size={64} photo={photo ?? undefined} />
              <PhotoPicker
                label={photo ? "Change photo" : "Add a photo (optional)"}
                className="rounded-2xl px-4 py-2.5 text-lg font-medium text-brand ring-2 ring-brand/40"
                onPhoto={setPhoto}
              />
            </div>

            {role !== "family" && (
              <Field label="Your neighbourhood">
                <select value={area} onChange={(e) => setArea(e.target.value)} className={input}>
                  {NEIGHBOURHOODS.map((n) => (
                    <option key={n.name}>{n.name}</option>
                  ))}
                </select>
              </Field>
            )}

            {role === "senior" && (
              <Field label="Street (optional)" hint="Only shown to a volunteer after they accept your request.">
                <input value={street} onChange={(e) => setStreet(e.target.value)} className={input} placeholder="e.g. 12 Brunswick St" />
              </Field>
            )}

            {role === "volunteer" && (
              <>
                <Field label="How can you help?">
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(TASKS) as TaskType[]).map((t) => (
                      <Chip key={t} on={skills.includes(t)} onClick={() => setSkills(toggle(skills, t))}>
                        {TASKS[t].label}
                      </Chip>
                    ))}
                  </div>
                </Field>
                <Field label="When are you usually free?">
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(WINDOWS) as Exclude<TimeWindow, "anytime">[]).map((w) => (
                      <Chip key={w} on={availability.includes(w)} onClick={() => setAvailability(toggle(availability, w))}>
                        {WINDOWS[w]}
                      </Chip>
                    ))}
                  </div>
                </Field>
                <Field label="How do you get around?" hint="Rides need a car or truck.">
                  <div className="flex flex-wrap gap-2">
                    {TRANSPORT.map((t) => (
                      <Chip key={t.value} on={transport === t.value} onClick={() => setTransport(t.value)}>
                        {t.label}
                      </Chip>
                    ))}
                  </div>
                </Field>
                <Field label="Organization (optional)">
                  <input value={org} onChange={(e) => setOrg(e.target.value)} className={input} placeholder="e.g. UNB Student Volunteers" />
                </Field>
              </>
            )}

            {role === "family" && (
              <>
                <Field label="Who are you connecting with?">
                  <select required value={seniorId} onChange={(e) => setSeniorId(e.target.value)} className={input}>
                    <option value="" disabled>
                      Choose a SeniorLink member
                    </option>
                    {state?.seniors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {s.area}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Your relationship">
                  <input value={relation} onChange={(e) => setRelation(e.target.value)} className={input} placeholder="e.g. Son, Granddaughter" />
                </Field>
                <Field label="What do you call them?">
                  <input value={callsThem} onChange={(e) => setCallsThem(e.target.value)} className={input} placeholder="e.g. Mom, Grandpa" />
                </Field>
              </>
            )}
          </Card>

          <p className="text-base text-muted">
            {role === "volunteer" && "New volunteers complete a quick ID check before they can be matched with seniors who ask for verified helpers."}
            {role === "family" && "They'll be asked to approve your request. You'll only see task status — never their messages or exact address."}
            {role === "senior" && "You decide who helps you and which family members can see your activity."}
          </p>

          {error && <p className="rounded-2xl bg-red-50 p-4 text-lg font-semibold text-red-800">{error}</p>}

          <button disabled={saving} className="rounded-3xl bg-brand py-5 text-2xl font-semibold text-white shadow-lg hover:bg-brand-dark disabled:opacity-60">
            {saving ? "Creating your profile…" : role === "family" ? "Send request" : "Create my profile"}
          </button>
        </form>
      )}
    </main>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-lg font-semibold">{label}</p>
      {children}
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
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
