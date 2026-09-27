"use client";

import { Bell, BellOff, Check, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useState } from "react";
import PhotoPicker from "@/components/PhotoPicker";
import PillPicture, { PILL_COLORS, PillDrawing } from "@/components/PillPicture";
import { Card } from "@/components/ui";
import { post } from "@/components/useAppState";
import type { useMedReminders } from "@/components/useMedReminders";
import { TIME_PRESETS, clock12, daysLeft, type ScheduledDose } from "@/lib/meds";
import type { AppState, Medication, PillLook, Senior } from "@/lib/types";

type Reminders = ReturnType<typeof useMedReminders>;

export default function Medicines({
  state,
  senior,
  reminders,
  onRefresh,
}: {
  state: AppState;
  senior: Senior;
  reminders: Reminders;
  onRefresh: () => void;
}) {
  const meds = state.medications.filter((m) => m.seniorId === senior.id);
  const { doses } = reminders;
  const taken = doses.filter((d) => d.status === "taken").length;
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-4xl font-semibold leading-tight">Your medicines</h1>
        <p className="mt-1 text-xl text-muted">
          {new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      <ReminderSetting reminders={reminders} />

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-2xl font-semibold">Today</h2>
          {doses.length > 0 && (
            <p className="text-lg text-muted">
              {taken} of {doses.length} taken
            </p>
          )}
        </div>
        {doses.length > 0 && (
          <div className="mb-3 h-3 overflow-hidden rounded-full bg-sand">
            <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${(taken / doses.length) * 100}%` }} />
          </div>
        )}
        {doses.length === 0 ? (
          <Card>
            <p className="text-lg text-muted">No medicines scheduled. Add one below.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {doses.map((d) => (
              <DoseRow key={`${d.med.id}-${d.time}`} dose={d} onRefresh={onRefresh} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-semibold">My medicine list</h2>
        <div className="flex flex-col gap-3">
          {meds.map((m) => (
            <MedCard key={m.id} med={m} state={state} onRefresh={onRefresh} />
          ))}
        </div>
        {adding ? (
          <AddMedicine seniorId={senior.id} onDone={() => { setAdding(false); onRefresh(); }} onCancel={() => setAdding(false)} />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-brand/50 py-5 text-xl font-semibold text-brand hover:bg-brand-soft"
          >
            <Plus size={24} /> Add a medicine
          </button>
        )}
        <p className="mt-3 text-sm text-muted">
          Only you can see your medicine list. Family members you approve see whether doses were taken, never which medicines.
        </p>
      </section>
    </div>
  );
}

function ReminderSetting({ reminders }: { reminders: Reminders }) {
  if (reminders.enabled) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-lg text-emerald-900">
        <Bell size={22} className="shrink-0" aria-hidden />
        <span className="flex-1">
          Reminders are on{reminders.permission === "denied" ? " (in the app only, notifications are blocked)" : ""}.
        </span>
        <button onClick={reminders.disable} className="text-base font-medium underline">
          Turn off
        </button>
      </div>
    );
  }
  return (
    <Card className="flex flex-col gap-3 ring-2 ring-accent/40">
      <p className="flex items-center gap-2 text-xl font-semibold">
        <BellOff size={22} className="text-accent" aria-hidden /> Reminders are off
      </p>
      <p className="text-lg text-muted">Get a notification and a spoken reminder when it&apos;s time for each medicine.</p>
      <button onClick={reminders.enable} className="rounded-2xl bg-accent py-4 text-xl font-semibold text-white">
        Turn on reminders
      </button>
    </Card>
  );
}

const DOSE_STYLE: Record<ScheduledDose["status"], { label: string; className: string }> = {
  taken: { label: "Taken", className: "bg-emerald-100 text-emerald-900" },
  skipped: { label: "Skipped", className: "bg-stone-200 text-stone-700" },
  due: { label: "Due now", className: "bg-accent text-white" },
  missed: { label: "Missed", className: "bg-red-100 text-red-800" },
  upcoming: { label: "Later", className: "bg-sand text-muted" },
};

export function DoseRow({ dose, onRefresh, compact }: { dose: ScheduledDose; onRefresh: () => void; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const { med, time, status } = dose;
  const open = status === "due" || status === "missed" || status === "upcoming";

  async function mark(s: "taken" | "skipped") {
    setBusy(true);
    await post("/api/meds", { action: "dose", medId: med.id, time, status: s });
    onRefresh();
    setBusy(false);
  }

  return (
    <Card className={`flex flex-col gap-3 ${status === "due" ? "ring-2 ring-accent" : ""} ${compact ? "p-4" : ""}`}>
      <div className="flex items-center gap-4">
        <PillPicture med={med} size={compact ? 48 : 56} />
        <div className="w-[4.5rem] shrink-0">
          <p className="text-lg font-semibold leading-tight">{clock12(time)}</p>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${DOSE_STYLE[status].className}`}>
            {DOSE_STYLE[status].label}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-xl font-semibold ${status === "taken" ? "text-muted line-through decoration-2" : ""}`}>
            {med.name} <span className="font-normal text-muted">{med.dose}</span>
          </p>
          {med.instructions && <p className="text-base text-muted">{med.instructions}</p>}
          {dose.log && (
            <p className="text-sm text-muted">
              {dose.log.status === "taken" ? "Taken" : "Skipped"} at{" "}
              {new Date(dose.log.at).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}
            </p>
          )}
        </div>
      </div>
      {open && (
        <div className="flex gap-2">
          <button
            onClick={() => mark("taken")}
            disabled={busy}
            className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-lg font-semibold disabled:opacity-50 ${
              status === "upcoming" ? "bg-white text-emerald-800 ring-2 ring-emerald-200" : "bg-emerald-700 text-white"
            }`}
          >
            <Check size={22} /> {status === "upcoming" ? "Took it early" : "Taken"}
          </button>
          <button
            onClick={() => mark("skipped")}
            disabled={busy}
            className="flex items-center justify-center gap-1 rounded-2xl px-4 py-3 text-lg font-medium text-muted ring-2 ring-sand disabled:opacity-50"
          >
            <X size={20} /> Skip
          </button>
        </div>
      )}
    </Card>
  );
}

function MedCard({ med, state, onRefresh }: { med: Medication; state: AppState; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const days = daysLeft(med);
  const low = days !== null && days <= 5;
  const refill = state.requests.find(
    (r) => r.seniorId === med.seniorId && r.title === "Prescription refill pickup" && r.status !== "completed" && r.status !== "cancelled",
  );
  const volunteer = state.volunteers.find((v) => v.id === (refill?.volunteerId ?? refill?.matchedVolunteerId));

  async function requestRefill() {
    setBusy(true);
    await post("/api/meds", { action: "refill", medId: med.id });
    onRefresh();
    setBusy(false);
  }

  async function remove() {
    await post("/api/meds", { action: "remove", medId: med.id });
    onRefresh();
  }

  return (
    <Card className={`flex flex-col gap-3 ${low ? "ring-2 ring-amber-400" : ""}`}>
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center gap-1">
          <PillPicture med={med} size={72} />
          <PhotoPicker
            label={med.photo ? "Change" : "Photo"}
            className="text-sm font-medium text-brand"
            onPhoto={async (url) => {
              await post("/api/meds", { action: "picture", medId: med.id, photo: url });
              onRefresh();
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-semibold">
            {med.name} <span className="font-normal text-muted">{med.dose}</span>
          </p>
          {med.purpose && <p className="text-base text-muted">For: {med.purpose}</p>}
          <p className="mt-1 text-base">{med.times.map(clock12).join(" · ")}</p>
          {days !== null && (
            <p className={`mt-1 text-base ${low ? "font-semibold text-amber-800" : "text-muted"}`}>
              {med.pillsLeft} left, about {days} day{days === 1 ? "" : "s"}
              {low ? ". Time for a refill." : ""}
            </p>
          )}
        </div>
        {!confirmRemove && (
          <button onClick={() => setConfirmRemove(true)} className="rounded-full p-2 text-muted hover:bg-sand" aria-label={`Remove ${med.name}`}>
            <Trash2 size={20} />
          </button>
        )}
      </div>

      {confirmRemove && (
        <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-3">
          <span className="flex-1 text-base">Remove {med.name} from your list?</span>
          <button onClick={remove} className="rounded-xl bg-red-700 px-3 py-2 font-semibold text-white">
            Remove
          </button>
          <button onClick={() => setConfirmRemove(false)} className="rounded-xl px-3 py-2 font-medium">
            Keep
          </button>
        </div>
      )}

      {low &&
        (refill ? (
          <p className="rounded-2xl bg-sky-50 p-3 text-base text-sky-900">
            Refill pickup requested{volunteer ? `. ${volunteer.name.split(" ")[0]} is ${refill.status === "matched" ? "matched" : "helping"}.` : "."}
          </p>
        ) : (
          <button
            onClick={requestRefill}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-2xl bg-brand py-3 text-lg font-semibold text-white disabled:opacity-50"
          >
            <ShoppingBag size={20} /> {busy ? "Finding a volunteer…" : "Ask a volunteer to pick up my refill"}
          </button>
        ))}
    </Card>
  );
}

function AddMedicine({ seniorId, onDone, onCancel }: { seniorId: string; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [purpose, setPurpose] = useState("");
  const [instructions, setInstructions] = useState("");
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [custom, setCustom] = useState("");
  const [pills, setPills] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [look, setLook] = useState<PillLook>({ shape: "round", color: "#FFFFFF" });
  const [error, setError] = useState<string | null>(null);
  const input = "w-full rounded-2xl border-2 border-sand bg-cream px-4 py-3 text-lg outline-none focus:border-brand";

  const toggle = (t: string) => setTimes(times.includes(t) ? times.filter((x) => x !== t) : [...times, t].sort());

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await post<{ error?: string }>("/api/meds", {
      action: "add",
      seniorId,
      med: { name, dose, purpose, instructions, times, pillsLeft: pills ? Number(pills) : undefined, photo: photo ?? undefined, look },
    });
    if (res.error) setError(res.error);
    else onDone();
  }

  return (
    <Card className="pop-in mt-3">
      <form onSubmit={save} className="flex flex-col gap-4">
        <p className="text-xl font-semibold">Add a medicine</p>
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="e.g. Metformin" autoFocus />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-base font-medium">Dose</span>
            <input value={dose} onChange={(e) => setDose(e.target.value)} className={input} placeholder="500 mg" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-base font-medium">Pills left</span>
            <input value={pills} onChange={(e) => setPills(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={input} placeholder="30" />
          </label>
        </div>
        <div>
          <p className="mb-2 text-base font-medium">What does it look like?</p>
          <div className="flex items-center gap-4">
            <PillPicture med={{ name: name || "Medicine", photo: photo ?? undefined, look }} size={80} />
            <div className="flex flex-col gap-2">
              <PhotoPicker
                label={photo ? "Retake photo" : "Take a photo"}
                className="rounded-2xl px-4 py-2.5 text-lg font-medium text-brand ring-2 ring-brand/40"
                onPhoto={setPhoto}
              />
              {photo && (
                <button type="button" onClick={() => setPhoto(null)} className="text-sm text-muted underline">
                  Use a drawing instead
                </button>
              )}
            </div>
          </div>
          {!photo && (
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex gap-2">
                {(["round", "oval", "capsule"] as const).map((shape) => (
                  <button
                    type="button"
                    key={shape}
                    onClick={() => setLook({ ...look, shape })}
                    aria-pressed={look.shape === shape}
                    aria-label={shape}
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl ${look.shape === shape ? "bg-brand-soft ring-2 ring-brand" : "bg-cream ring-2 ring-sand"}`}
                  >
                    <PillDrawing look={{ ...look, shape }} size={36} />
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Pill colour">
                {PILL_COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setLook({ ...look, color: c })}
                    aria-pressed={look.color === c}
                    aria-label={`Colour ${c}`}
                    className={`h-10 w-10 rounded-full ring-2 ${look.color === c ? "ring-brand ring-offset-2" : "ring-black/10"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium">What it&apos;s for (optional)</span>
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className={input} placeholder="e.g. Blood pressure" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium">Instructions (optional)</span>
          <input value={instructions} onChange={(e) => setInstructions(e.target.value)} className={input} placeholder="e.g. With food" />
        </label>
        <div>
          <p className="mb-2 text-base font-medium">When do you take it?</p>
          <div className="flex flex-wrap gap-2">
            {TIME_PRESETS.map((p) => (
              <button
                type="button"
                key={p.time}
                onClick={() => toggle(p.time)}
                aria-pressed={times.includes(p.time)}
                className={`rounded-2xl px-4 py-2.5 text-lg font-medium ${times.includes(p.time) ? "bg-brand text-white" : "bg-cream ring-2 ring-sand"}`}
              >
                {p.label} <span className="text-sm opacity-80">{clock12(p.time)}</span>
              </button>
            ))}
            {times
              .filter((t) => !TIME_PRESETS.some((p) => p.time === t))
              .map((t) => (
                <button type="button" key={t} onClick={() => toggle(t)} className="rounded-2xl bg-brand px-4 py-2.5 text-lg font-medium text-white">
                  <span className="inline-flex items-center gap-1.5">
                    {clock12(t)} <X size={16} aria-label="remove" />
                  </span>
                </button>
              ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input type="time" value={custom} onChange={(e) => setCustom(e.target.value)} className="rounded-2xl border-2 border-sand bg-cream px-3 py-2 text-lg" aria-label="Other time" />
            <button
              type="button"
              disabled={!custom}
              onClick={() => {
                if (custom && !times.includes(custom)) setTimes([...times, custom].sort());
                setCustom("");
              }}
              className="rounded-2xl px-4 font-medium text-brand ring-2 ring-brand/40 disabled:opacity-40"
            >
              Add time
            </button>
          </div>
        </div>
        {error && <p className="font-medium text-red-700">{error}</p>}
        <div className="flex gap-3">
          <button className="flex-1 rounded-2xl bg-brand py-4 text-xl font-semibold text-white">Save</button>
          <button type="button" onClick={onCancel} className="rounded-2xl px-5 text-lg font-medium text-muted">
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
