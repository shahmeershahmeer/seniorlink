"use client";

import { Car, Check, Clock, Flag, MapPin, Minus, Navigation, Pill as PillIcon, Plus, Receipt, ShieldCheck, ShoppingBasket, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import CommunityMap, { type MapPoint } from "@/components/Map";
import { post } from "@/components/useAppState";
import { clockIn, directionsUrl, rideStatus } from "@/lib/eta";
import { clock12 } from "@/lib/meds";
import { GROCERY_STORES, RIDE_SHORTCUTS } from "@/lib/places";
import type { Draft, HelpRequest, Medication, ShoppingItem, Volunteer } from "@/lib/types";

const input = "w-full rounded-2xl border-2 border-sand bg-cream px-4 py-3 text-lg outline-none focus:border-brand";

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-base font-semibold text-muted">{children}</p>;
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
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

// ---------- Request form sections ----------

export function RideFields({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...draft, [k]: v });
  return (
    <>
      <div>
        <Label>Pick me up at</Label>
        <div className="flex items-center gap-2">
          <MapPin size={22} className="shrink-0 text-blue-600" aria-hidden />
          <input value={draft.location} onChange={(e) => set("location", e.target.value)} className={input} aria-label="Pick-up address" />
        </div>
      </div>
      <div>
        <Label>Take me to</Label>
        <div className="flex items-center gap-2">
          <Flag size={22} className="shrink-0 text-red-600" aria-hidden />
          <input
            value={draft.destination ?? ""}
            onChange={(e) => set("destination", e.target.value || null)}
            className={input}
            placeholder="e.g. Dr. Everett Chalmers Hospital"
            aria-label="Destination"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {RIDE_SHORTCUTS.map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => set("destination", p)}
              className={`rounded-full px-3 py-1.5 text-base ${draft.destination === p ? "bg-brand text-white" : "bg-white ring-1 ring-black/10"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col">
          <Label>Appointment time</Label>
          <input
            type="time"
            value={draft.appointmentTime ?? ""}
            onChange={(e) => {
              const t = e.target.value || null;
              const h = t ? parseInt(t, 10) : null;
              onChange({
                ...draft,
                appointmentTime: t,
                ...(h != null && { timeWindow: h < 12 ? "morning" : h < 17 ? "afternoon" : "evening", timeLabel: `Appointment ${clock12(t!)}` }),
              });
            }}
            className={input}
          />
        </label>
        <div>
          <Label>Ride home</Label>
          <Pill on={Boolean(draft.roundTrip)} onClick={() => set("roundTrip", !draft.roundTrip)}>
            {draft.roundTrip ? "Yes, bring me back" : "One way"}
          </Pill>
        </div>
      </div>
    </>
  );
}

const QUICK_ITEMS = ["Milk", "Bread", "Eggs", "Butter", "Bananas", "Apples", "Cheese", "Yogurt", "Coffee", "Tea", "Soup", "Toilet paper"];

export function GroceryFields({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...draft, [k]: v });
  const list = draft.shoppingList ?? [];
  const [item, setItem] = useState("");

  const add = (name: string) => {
    const n = name.trim();
    if (!n) return;
    const existing = list.find((i) => i.name.toLowerCase() === n.toLowerCase());
    set(
      "shoppingList",
      existing
        ? list.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i))
        : [...list, { id: `item${Date.now().toString(36)}${list.length}`, name: n[0].toUpperCase() + n.slice(1), qty: 1 }],
    );
    setItem("");
  };
  const update = (id: string, patch: Partial<ShoppingItem> | null) =>
    set("shoppingList", patch ? list.map((i) => (i.id === id ? { ...i, ...patch } : i)) : list.filter((i) => i.id !== id));

  return (
    <>
      <div>
        <Label>Shopping list {list.length > 0 && `(${list.length} item${list.length === 1 ? "" : "s"})`}</Label>
        {list.length > 0 && (
          <ul className="mb-3 flex flex-col divide-y divide-sand rounded-2xl bg-cream ring-2 ring-sand">
            {list.map((i) => (
              <li key={i.id} className="flex items-center gap-2 px-3 py-2">
                <input
                  value={i.name}
                  onChange={(e) => update(i.id, { name: e.target.value })}
                  className="min-w-0 flex-1 bg-transparent py-1 text-lg outline-none"
                  aria-label="Item"
                />
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => update(i.id, { qty: Math.max(1, i.qty - 1) })} className="flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-black/10" aria-label={`Fewer ${i.name}`}>
                    <Minus size={18} />
                  </button>
                  <span className="w-8 text-center text-lg font-semibold">{i.qty}</span>
                  <button type="button" onClick={() => update(i.id, { qty: Math.min(99, i.qty + 1) })} className="flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-black/10" aria-label={`More ${i.name}`}>
                    <Plus size={18} />
                  </button>
                </div>
                <button type="button" onClick={() => update(i.id, null)} className="p-2 text-muted" aria-label={`Remove ${i.name}`}>
                  <Trash2 size={20} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add(item);
          }}
          className="flex gap-2"
        >
          <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Add an item, e.g. 2% milk" className={input} aria-label="Add an item" />
          <button disabled={!item.trim()} className="rounded-2xl bg-brand px-4 text-white disabled:opacity-40" aria-label="Add item">
            <Plus size={24} />
          </button>
        </form>
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_ITEMS.filter((q) => !list.some((i) => i.name.toLowerCase() === q.toLowerCase())).map((q) => (
            <button type="button" key={q} onClick={() => add(q)} className="rounded-full bg-white px-3 py-1.5 text-base ring-1 ring-black/10">
              + {q}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Which store?</Label>
        <div className="flex flex-wrap gap-2">
          {GROCERY_STORES.map((st) => (
            <Pill key={st} on={draft.destination === st} onClick={() => set("destination", st)}>
              {st}
            </Pill>
          ))}
          <Pill on={!draft.destination} onClick={() => set("destination", null)}>
            Any store
          </Pill>
        </div>
      </div>

      <div>
        <Label>If something is out of stock</Label>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["similar", "Get something similar"],
              ["skip", "Skip it"],
              ["call", "Call me"],
            ] as const
          ).map(([k, label]) => (
            <Pill key={k} on={(draft.substitutions ?? "similar") === k} onClick={() => set("substitutions", k)}>
              {label}
            </Pill>
          ))}
        </div>
      </div>

      <div>
        <Label>How will you pay?</Label>
        <div className="flex flex-col gap-2">
          <Pill on={(draft.payment ?? "pay_back") === "pay_back"} onClick={() => set("payment", "pay_back")}>
            I&apos;ll pay the volunteer back when they deliver
          </Pill>
          <Pill on={draft.payment === "paid_online"} onClick={() => set("payment", "paid_online")}>
            I paid online, it just needs picking up
          </Pill>
        </div>
        {(draft.payment ?? "pay_back") === "pay_back" && (
          <label className="mt-3 flex items-center gap-2 rounded-2xl border-2 border-sand bg-cream px-4 py-3 focus-within:border-brand">
            <span className="text-lg text-muted">Spend up to $</span>
            <input
              value={draft.budget ?? ""}
              onChange={(e) => set("budget", e.target.value ? Number(e.target.value.replace(/\D/g, "").slice(0, 4)) : null)}
              inputMode="numeric"
              placeholder="e.g. 60"
              className="min-w-0 flex-1 bg-transparent text-lg outline-none"
            />
          </label>
        )}
      </div>
    </>
  );
}

const PHARMACIES = ["Shoppers Drug Mart (Prospect St)", "Jean Coutu", "Lawtons Drugs", "Walmart Pharmacy", "Superstore Pharmacy"];
const OTC_QUICK = ["Acetaminophen (Tylenol)", "Antacid (Tums)", "Cough syrup", "Saline nasal spray", "Throat lozenges", "Bandages"];

function KindBadge({ kind }: { kind?: ShoppingItem["kind"] }) {
  if (!kind) return null;
  return kind === "prescription" ? (
    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900">Prescription</span>
  ) : (
    <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-700">Over the counter</span>
  );
}

export function PharmacyFields({ draft, onChange, meds = [] }: { draft: Draft; onChange: (d: Draft) => void; meds?: Medication[] }) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...draft, [k]: v });
  const list = draft.shoppingList ?? [];
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"prescription" | "otc">("prescription");

  const has = (n: string) => list.some((i) => i.name.toLowerCase() === n.toLowerCase());
  const add = (n: string, k: "prescription" | "otc") => {
    const t = n.trim();
    if (!t || has(t)) return;
    set("shoppingList", [...list, { id: `item${Date.now().toString(36)}${list.length}`, name: t, qty: 1, kind: k }]);
    setName("");
  };
  const update = (id: string, patch: Partial<ShoppingItem> | null) =>
    set("shoppingList", patch ? list.map((i) => (i.id === id ? { ...i, ...patch } : i)) : list.filter((i) => i.id !== id));

  const myMeds = meds.map((m) => `${m.name} ${m.dose}`.trim()).filter((n) => !has(n));

  return (
    <>
      <div>
        <Label>What to pick up {list.length > 0 && `(${list.length} item${list.length === 1 ? "" : "s"})`}</Label>
        {list.length > 0 && (
          <ul className="mb-3 flex flex-col divide-y divide-sand rounded-2xl bg-cream ring-2 ring-sand">
            {list.map((i) => (
              <li key={i.id} className="flex flex-col gap-2 px-3 py-3">
                <div className="flex items-center gap-2">
                  <input
                    value={i.name}
                    onChange={(e) => update(i.id, { name: e.target.value })}
                    className="min-w-0 flex-1 bg-transparent py-1 text-lg font-medium outline-none"
                    aria-label="Medicine"
                  />
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => update(i.id, { qty: Math.max(1, i.qty - 1) })} className="flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-black/10" aria-label={`Fewer ${i.name}`}>
                      <Minus size={18} />
                    </button>
                    <span className="w-8 text-center text-lg font-semibold">{i.qty}</span>
                    <button type="button" onClick={() => update(i.id, { qty: Math.min(20, i.qty + 1) })} className="flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-black/10" aria-label={`More ${i.name}`}>
                      <Plus size={18} />
                    </button>
                  </div>
                  <button type="button" onClick={() => update(i.id, null)} className="p-2 text-muted" aria-label={`Remove ${i.name}`}>
                    <Trash2 size={20} />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(["prescription", "otc"] as const).map((k) => (
                    <button
                      type="button"
                      key={k}
                      onClick={() => update(i.id, { kind: k, ...(k === "otc" && { rxNumber: undefined }) })}
                      aria-pressed={i.kind === k}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium ${i.kind === k ? "bg-brand text-white" : "bg-white ring-1 ring-black/10"}`}
                    >
                      {k === "prescription" ? "Prescription" : "Over the counter"}
                    </button>
                  ))}
                  {i.kind === "prescription" && (
                    <input
                      value={i.rxNumber ?? ""}
                      onChange={(e) => update(i.id, { rxNumber: e.target.value.slice(0, 20) || undefined })}
                      placeholder="Rx number (optional)"
                      aria-label={`Prescription number for ${i.name}`}
                      className="min-w-0 flex-1 rounded-xl bg-white px-3 py-1.5 text-base ring-1 ring-black/10 outline-none focus:ring-brand"
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {myMeds.length > 0 && (
          <div className="mb-3">
            <p className="mb-1.5 text-sm font-medium text-muted">From your medicine list</p>
            <div className="flex flex-wrap gap-2">
              {myMeds.map((m) => (
                <button type="button" key={m} onClick={() => add(m, "prescription")} className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-base text-sky-900 ring-1 ring-sky-200">
                  <PillIcon size={16} /> {m}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            add(name, kind);
          }}
          className="flex flex-col gap-2"
        >
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a medicine or product" className={input} aria-label="Add a medicine" />
            <button disabled={!name.trim()} className="rounded-2xl bg-brand px-4 text-white disabled:opacity-40" aria-label="Add">
              <Plus size={24} />
            </button>
          </div>
          <div className="flex gap-2">
            {(["prescription", "otc"] as const).map((k) => (
              <button
                type="button"
                key={k}
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${kind === k ? "bg-ink text-white" : "bg-white ring-1 ring-black/10"}`}
              >
                {k === "prescription" ? "Prescription" : "Over the counter"}
              </button>
            ))}
          </div>
        </form>
        <div className="mt-2 flex flex-wrap gap-2">
          {OTC_QUICK.filter((q) => !has(q)).map((q) => (
            <button type="button" key={q} onClick={() => add(q, "otc")} className="rounded-full bg-white px-3 py-1.5 text-base ring-1 ring-black/10">
              + {q}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">Only your volunteer sees this list. Family members see progress, never medicine names.</p>
      </div>

      <div>
        <Label>Which pharmacy?</Label>
        <div className="flex flex-wrap gap-2">
          {PHARMACIES.map((p) => (
            <Pill key={p} on={draft.destination === p} onClick={() => set("destination", p)}>
              {p}
            </Pill>
          ))}
        </div>
        <input
          value={draft.destination && !PHARMACIES.includes(draft.destination) ? draft.destination : ""}
          onChange={(e) => set("destination", e.target.value || null)}
          placeholder="Or type another pharmacy"
          className={`${input} mt-2`}
        />
      </div>

      {list.some((i) => i.kind === "prescription") && (
        <div>
          <Label>Pick-up permission</Label>
          <button
            type="button"
            onClick={() => set("pharmacyAuthorized", !draft.pharmacyAuthorized)}
            aria-pressed={Boolean(draft.pharmacyAuthorized)}
            className={`flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left text-lg ${draft.pharmacyAuthorized ? "bg-brand-soft ring-2 ring-brand" : "ring-2 ring-sand"}`}
          >
            <span className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${draft.pharmacyAuthorized ? "border-brand bg-brand text-white" : "border-stone-300"}`}>
              {draft.pharmacyAuthorized && <Check size={16} strokeWidth={3} />}
            </span>
            <span>I&apos;ve told the pharmacy a SeniorLink volunteer will pick up my prescription</span>
          </button>
          <p className="mt-1 text-sm text-muted">Most pharmacies need your OK before giving a prescription to someone else. A quick call is enough.</p>
        </div>
      )}

      <div>
        <Label>How will you pay?</Label>
        <div className="flex flex-col gap-2">
          <Pill on={(draft.payment ?? "pay_back") === "pay_back"} onClick={() => set("payment", "pay_back")}>
            I&apos;ll pay the volunteer back when they deliver
          </Pill>
          <Pill on={draft.payment === "paid_online"} onClick={() => set("payment", "paid_online")}>
            Already paid, or covered by my drug plan
          </Pill>
        </div>
      </div>
    </>
  );
}

// ---------- Live views ----------

/** Ride progress for the senior and family: waiting → driver on the way (ETA) → picked up (arrival). */
export function RideTracker({ r, driver, viewer = "senior" }: { r: HelpRequest; driver?: Volunteer; viewer?: "senior" | "family" }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const s = rideStatus(r, driver);
  const name = driver?.name.split(" ")[0] ?? "Your driver";
  const you = viewer === "senior" ? "you" : r.seniorName.split(" ")[0];

  const points: MapPoint[] = [
    { id: "pickup", lat: s.pickup.lat, lng: s.pickup.lng, kind: "pickup", label: "Pick-up" },
    ...(s.dest ? [{ id: "dest", lat: s.dest.lat, lng: s.dest.lng, kind: "destination" as const, label: r.destination ?? "Destination" }] : []),
    ...(s.driver && s.phase !== "done" ? [{ id: "driver", lat: s.driver.lat, lng: s.driver.lng, kind: "driver" as const, label: `${name}'s car` }] : []),
  ];
  const at = (p: { lat: number; lng: number }): [number, number] => [p.lat, p.lng];
  const route: [number, number][] =
    s.phase === "to_pickup" && s.driver
      ? [at(s.driver), at(s.pickup), ...(s.dest ? [at(s.dest)] : [])]
      : s.phase === "picked_up" && s.driver && s.dest
        ? [at(s.driver), at(s.dest)]
        : [at(s.pickup), ...(s.dest ? [at(s.dest)] : [])];

  const headline =
    s.phase === "waiting"
      ? "Waiting for a driver"
      : s.phase === "accepted"
        ? `${name} will drive ${you}`
        : s.phase === "to_pickup"
          ? `${name} arrives in ${s.toPickupMin} min`
          : s.phase === "picked_up"
            ? `On the way${r.destination ? ` to ${r.destination}` : ""}`
            : "Arrived";

  return (
    <div className="flex flex-col gap-3">
      <div className={`rounded-2xl p-4 ${s.phase === "waiting" ? "bg-amber-50 text-amber-950" : "bg-brand-soft"}`}>
        <p className="flex items-center gap-2 text-2xl font-semibold">
          {s.phase === "waiting" ? <Clock size={26} className="animate-pulse" /> : <Car size={26} className="text-brand" />}
          {headline}
        </p>
        {s.phase === "waiting" && <p className="mt-1 text-lg">We&apos;ll show the driver&apos;s arrival time as soon as a volunteer accepts.</p>}
      </div>

      <div className="overflow-hidden rounded-2xl ring-1 ring-black/5">
        <CommunityMap points={points} route={route} fit height="h-56" />
      </div>

      <dl className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-2xl bg-cream p-3">
          <dt className="text-sm text-muted">Driver arrives</dt>
          <dd className="text-xl font-semibold">
            {s.phase === "waiting" ? "Waiting…" : s.phase === "accepted" ? `~${s.toPickupMin} min drive` : s.phase === "to_pickup" ? clockIn(s.toPickupMin ?? 0) : "Picked up"}
          </dd>
        </div>
        <div className="rounded-2xl bg-cream p-3">
          <dt className="text-sm text-muted">Arrive at destination</dt>
          <dd className="text-xl font-semibold">
            {s.phase === "done"
              ? "Arrived"
              : s.phase === "waiting" || s.phase === "accepted"
                ? s.tripMin != null
                  ? `~${s.tripMin} min trip`
                  : "—"
                : s.arrivalMin != null
                  ? clockIn(s.arrivalMin)
                  : "—"}
          </dd>
        </div>
      </dl>

      <ul className="flex flex-col gap-1 text-lg">
        <li className="flex items-center gap-2">
          <MapPin size={20} className="shrink-0 text-blue-600" aria-hidden /> {r.location}
        </li>
        <li className="flex items-center gap-2">
          <Flag size={20} className="shrink-0 text-red-600" aria-hidden /> {r.destination ?? "Destination not set"}
        </li>
        {r.appointmentTime && (
          <li className="flex items-center gap-2">
            <Clock size={20} className="shrink-0 text-muted" aria-hidden /> Appointment at {clock12(r.appointmentTime)}
            {r.roundTrip ? " · ride home included" : ""}
          </li>
        )}
      </ul>
      {s.phase !== "waiting" && (
        <p className="text-sm text-muted">Times are estimates based on typical Fredericton driving.</p>
      )}
    </div>
  );
}

/** Shopping list progress for the senior and family. */
export function ShoppingProgress({ r, hideNames = false }: { r: HelpRequest; hideNames?: boolean }) {
  const list = r.shoppingList ?? [];
  if (!list.length) return null;
  const pharmacy = r.taskType === "pharmacy";
  const got = list.filter((i) => i.status === "got").length;
  const out = list.filter((i) => i.status === "unavailable").length;
  const shopping = r.status === "in_progress";
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-xl font-semibold">
        {pharmacy ? <PillIcon size={24} className="text-brand" aria-hidden /> : <ShoppingBasket size={24} className="text-brand" aria-hidden />}
        {shopping || r.status === "completed"
          ? `${got} of ${list.length} items ${pharmacy ? "picked up" : "found"}`
          : `${list.length} item${list.length === 1 ? "" : "s"} ${hideNames ? "to pick up" : "on your list"}`}
        {out > 0 && <span className="text-base font-medium text-amber-800">· {out} out of stock</span>}
      </p>
      {(shopping || r.status === "completed") && (
        <div className="h-3 overflow-hidden rounded-full bg-sand">
          <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${((got + out) / list.length) * 100}%` }} />
        </div>
      )}
      {!hideNames && (
      <ul className="flex flex-col divide-y divide-sand rounded-2xl bg-cream">
        {list.map((i) => (
          <li key={i.id} className="flex items-center gap-3 px-4 py-2.5 text-lg">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                i.status === "got" ? "bg-emerald-600 text-white" : i.status === "unavailable" ? "bg-amber-100 text-amber-800" : "bg-white ring-2 ring-sand"
              }`}
            >
              {i.status === "got" ? <Check size={16} strokeWidth={3} /> : i.status === "unavailable" ? <X size={16} /> : null}
            </span>
            <span className={`flex flex-1 flex-wrap items-center gap-2 ${i.status === "unavailable" ? "text-muted line-through" : ""}`}>
              {i.name} <KindBadge kind={i.kind} />
            </span>
            <span className="text-muted">× {i.qty}</span>
          </li>
        ))}
      </ul>
      )}
      <p className="text-base text-muted">
        {pharmacy
          ? `${r.destination ?? "Pharmacy not chosen"}${r.pharmacyAuthorized ? " · pharmacy has been told" : ""}`
          : `${r.destination ?? "Any store"} · out of stock: ${{ similar: "get something similar", skip: "skip it", call: "call first" }[r.substitutions ?? "similar"]}`}
      </p>
      {r.receiptTotal != null && (
        <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-lg text-emerald-900">
          <Receipt size={22} aria-hidden /> Receipt total <b className="font-semibold">${r.receiptTotal.toFixed(2)}</b>
          {r.payment !== "paid_online" && !hideNames && " · pay your volunteer back"}
        </p>
      )}
    </div>
  );
}

// ---------- Volunteer controls ----------

export function VolunteerRideControls({
  r,
  me,
  busy,
  onAct,
}: {
  r: HelpRequest;
  me: Volunteer;
  busy: boolean;
  onAct: (action: "start" | "pickup") => void;
}) {
  const s = rideStatus(r, me);
  const target = s.phase === "picked_up" && s.dest ? s.dest : s.pickup;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-2xl bg-cream p-3">
          <p className="text-sm text-muted">To pick-up</p>
          <p className="text-xl font-semibold">{s.phase === "picked_up" ? "Done" : `${s.toPickupMin ?? "—"} min`}</p>
        </div>
        <div className="rounded-2xl bg-cream p-3">
          <p className="text-sm text-muted">Then to destination</p>
          <p className="text-xl font-semibold">{s.tripMin != null ? `${s.phase === "picked_up" ? s.arrivalMin : s.tripMin} min` : "—"}</p>
        </div>
      </div>
      <a
        href={directionsUrl({ lat: me.lat, lng: me.lng }, target)}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 rounded-2xl py-3 text-lg font-semibold text-brand ring-2 ring-brand/40"
      >
        <Navigation size={20} /> Directions to {s.phase === "picked_up" ? "destination" : "pick-up"}
      </a>
      {r.status === "accepted" ? (
        <button onClick={() => onAct("start")} disabled={busy} className="w-full rounded-2xl bg-accent py-4 text-xl font-semibold text-white disabled:opacity-50">
          Start driving to pick-up
        </button>
      ) : r.rideStage !== "picked_up" ? (
        <button onClick={() => onAct("pickup")} disabled={busy} className="w-full rounded-2xl bg-brand py-4 text-xl font-semibold text-white disabled:opacity-50">
          {r.seniorName.split(" ")[0]} is in the car
        </button>
      ) : null}
    </div>
  );
}

export function ShoppingChecklist({ r, volunteerId, onChange }: { r: HelpRequest; volunteerId: string; onChange: () => void }) {
  const list = r.shoppingList ?? [];
  const [pending, setPending] = useState<string | null>(null);
  if (!list.length) return null;

  async function mark(item: ShoppingItem, status: ShoppingItem["status"] | null) {
    setPending(item.id);
    await post(`/api/requests/${r.id}`, { action: "item", volunteerId, itemId: item.id, itemStatus: status });
    onChange();
    setPending(null);
  }

  const shopping = r.status === "in_progress";
  const pharmacy = r.taskType === "pharmacy";
  const hasRx = list.some((i) => i.kind === "prescription");
  return (
    <div className="flex flex-col gap-2">
      <p className="text-lg font-semibold">
        {pharmacy ? "Pharmacy list" : "Shopping list"} · {list.filter((i) => i.status).length}/{list.length} done
      </p>
      {pharmacy ? (
        <>
          {hasRx && (
            <p className={`flex items-start gap-2 rounded-xl p-3 text-base ${r.pharmacyAuthorized ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-950"}`}>
              <ShieldCheck size={20} className="mt-0.5 shrink-0" aria-hidden />
              {r.pharmacyAuthorized
                ? `${r.seniorName.split(" ")[0]} has told the pharmacy you're picking up. Give their full name at the counter.`
                : `Call the pharmacy first: ${r.seniorName.split(" ")[0]} may need to give permission for you to pick up.`}
            </p>
          )}
          <p className="text-sm text-muted">{r.payment === "paid_online" ? "Already paid or covered by their plan" : "Senior pays you back on delivery"}</p>
        </>
      ) : (
        <p className="text-sm text-muted">
          If out of stock: {{ similar: "get something similar", skip: "skip it", call: "call the senior first" }[r.substitutions ?? "similar"]}
          {r.budget ? ` · budget up to $${r.budget}` : ""}
          {r.payment === "paid_online" ? " · already paid online" : " · senior pays you back on delivery"}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {list.map((i) => (
          <li key={i.id} className={`flex items-center gap-2 rounded-2xl p-2 ${i.status === "got" ? "bg-emerald-50" : i.status === "unavailable" ? "bg-amber-50" : "bg-cream"}`}>
            <button
              disabled={!shopping || pending === i.id}
              onClick={() => mark(i, i.status === "got" ? null : "got")}
              aria-pressed={i.status === "got"}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${i.status === "got" ? "bg-emerald-600 text-white" : "bg-white ring-2 ring-sand"} disabled:opacity-60`}
              aria-label={`Got ${i.name}`}
            >
              <Check size={22} strokeWidth={3} />
            </button>
            <span className={`flex flex-1 flex-wrap items-center gap-2 text-lg ${i.status === "unavailable" ? "text-muted line-through" : ""}`}>
              {i.name} <span className="text-muted">× {i.qty}</span> <KindBadge kind={i.kind} />
              {i.rxNumber && <span className="text-sm text-muted">Rx {i.rxNumber}</span>}
            </span>
            {shopping && (
              <button
                disabled={pending === i.id}
                onClick={() => mark(i, i.status === "unavailable" ? null : "unavailable")}
                className={`rounded-xl px-3 py-2 text-sm font-medium ${i.status === "unavailable" ? "bg-amber-600 text-white" : "text-muted ring-1 ring-sand"}`}
              >
                {pharmacy ? "Not ready" : "Out"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {!shopping && <p className="text-sm text-muted">Tap &ldquo;I&apos;m on my way&rdquo; to start ticking items off.</p>}
    </div>
  );
}
