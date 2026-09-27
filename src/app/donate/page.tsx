"use client";

import { ArrowLeft, CircleCheck, Heart, Lock, Repeat } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui";
import { post, useAppState } from "@/components/useAppState";
import { FUNDS, fundById } from "@/lib/funds";
import type { Donation } from "@/lib/types";

const AMOUNTS = [10, 25, 50, 100];

export default function DonatePage() {
  const router = useRouter();
  const { state, refresh } = useAppState(5000);
  const [fundId, setFundId] = useState(FUNDS[0].id);
  const [amount, setAmount] = useState(25);
  const [custom, setCustom] = useState("");
  const [monthly, setMonthly] = useState(false);
  const [name, setName] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [step, setStep] = useState<"form" | "processing" | "done">("form");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Donation | null>(null);

  const total = (id: string) => state?.donations.filter((d) => d.fundId === id).reduce((t, d) => t + d.amount, 0) ?? 0;
  const value = custom ? Number(custom) : amount;
  const fund = fundById(fundId)!;
  const impact = [...fund.impact].reverse().find((i) => value >= i.amount) ?? fund.impact[0];
  const supporters = state?.donations.length ?? 0;

  async function give() {
    setStep("processing");
    setError(null);
    // Demo mode: a short pause stands in for the payment provider's checkout.
    await new Promise((r) => setTimeout(r, 1200));
    const res = await post<{ donation?: Donation; error?: string }>("/api/donate", {
      fundId,
      amount: value,
      monthly,
      name: anonymous ? null : name,
    });
    if (res.error || !res.donation) {
      setError(res.error ?? "Something went wrong");
      setStep("form");
      return;
    }
    setDone(res.donation);
    setStep("done");
    refresh();
  }

  if (step === "done" && done) {
    const f = fundById(done.fundId)!;
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CircleCheck size={56} />
        </span>
        <h1 className="text-4xl font-semibold">Thank you{done.name ? `, ${done.name.split(" ")[0]}` : ""}!</h1>
        <p className="text-xl">
          Your {done.monthly ? "monthly " : ""}gift of <b className="font-semibold">${done.amount}</b> to &ldquo;{f.name}&rdquo; {impactText(f.impact, done.amount)}.
        </p>
        <p className="text-muted">A receipt would be emailed to you. (Demo mode: no payment was taken.)</p>
        <button onClick={() => router.push("/")} className="w-full rounded-3xl bg-brand py-5 text-xl font-semibold text-white">
          Back to SeniorLink
        </button>
      </main>
    );
  }

  return (
    <main className="px-5 pb-12 pt-4">
      <button onClick={() => router.back()} className="-ml-3 flex h-12 items-center gap-1.5 rounded-full px-3 text-lg font-medium text-brand hover:bg-brand-soft">
        <ArrowLeft size={22} /> Back
      </button>
      <h1 className="mt-3 flex items-center gap-3 text-4xl font-semibold">
        <Heart size={34} className="fill-accent text-accent" aria-hidden /> Support SeniorLink
      </h1>
      <p className="mt-2 text-xl text-muted">
        SeniorLink is free for seniors and volunteers. Donations from {supporters} neighbours keep it that way.
      </p>

      <section className="mt-6 flex flex-col gap-3">
        <p className="text-lg font-semibold">Choose where your gift goes</p>
        {FUNDS.map((f) => {
          const raised = total(f.id);
          const on = f.id === fundId;
          return (
            <button
              key={f.id}
              onClick={() => setFundId(f.id)}
              aria-pressed={on}
              className={`rounded-3xl bg-white p-5 text-left shadow-sm transition ${on ? "ring-4 ring-brand" : "ring-1 ring-black/5"}`}
            >
              <p className="text-xl font-semibold">{f.name}</p>
              <p className="mt-1 text-base text-muted">{f.description}</p>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-sand">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (raised / f.goal) * 100)}%` }} />
              </div>
              <p className="mt-1 text-sm text-muted">
                ${raised.toLocaleString("en-CA")} raised of ${f.goal.toLocaleString("en-CA")}
              </p>
            </button>
          );
        })}
      </section>

      <Card className="mt-6 flex flex-col gap-4">
        <p className="text-lg font-semibold">Amount</p>
        <div className="grid grid-cols-4 gap-2">
          {AMOUNTS.map((a) => (
            <button
              key={a}
              onClick={() => {
                setAmount(a);
                setCustom("");
              }}
              aria-pressed={!custom && amount === a}
              className={`rounded-2xl py-4 text-xl font-semibold ${!custom && amount === a ? "bg-brand text-white" : "bg-cream ring-2 ring-sand"}`}
            >
              ${a}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 rounded-2xl border-2 border-sand bg-cream px-4 py-3 focus-within:border-brand">
          <span className="text-lg text-muted">Other $</span>
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 5))}
            inputMode="numeric"
            className="min-w-0 flex-1 bg-transparent text-lg outline-none"
            placeholder="Any amount"
          />
        </label>
        {value > 0 && (
          <p className="rounded-2xl bg-accent-soft p-4 text-lg">
            <b className="font-semibold">${value}</b> {impactText(fund.impact, value)}
            {impact.amount > value ? "" : "."}
          </p>
        )}

        <button
          onClick={() => setMonthly(!monthly)}
          aria-pressed={monthly}
          className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-lg ${monthly ? "bg-brand-soft ring-2 ring-brand" : "ring-2 ring-sand"}`}
        >
          <Repeat size={22} className="text-brand" />
          <span className="flex-1">Make it monthly</span>
          <span className={`h-6 w-6 rounded-md border-2 ${monthly ? "border-brand bg-brand" : "border-stone-300"}`} />
        </button>

        <div className="flex flex-col gap-2">
          <label className="text-lg font-semibold" htmlFor="donor-name">
            Your name
          </label>
          <input
            id="donor-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={anonymous}
            placeholder="For your thank-you and receipt"
            className="rounded-2xl border-2 border-sand bg-cream px-4 py-3 text-lg outline-none focus:border-brand disabled:opacity-50"
          />
          <button onClick={() => setAnonymous(!anonymous)} className="flex items-center gap-2 self-start text-base">
            <span className={`h-5 w-5 rounded border-2 ${anonymous ? "border-brand bg-brand" : "border-stone-300"}`} /> Give anonymously
          </button>
        </div>

        {error && <p className="font-medium text-red-700">{error}</p>}
        <button
          onClick={give}
          disabled={step === "processing" || !(value >= 1)}
          className="flex items-center justify-center gap-2 rounded-3xl bg-accent py-5 text-2xl font-semibold text-white shadow-lg disabled:opacity-60"
        >
          <Heart size={24} className="fill-white" /> {step === "processing" ? "Processing…" : `Give $${value || 0}${monthly ? " a month" : ""}`}
        </button>
        <p className="flex items-start gap-2 text-sm text-muted">
          <Lock size={16} className="mt-0.5 shrink-0" />
          Demo mode: no payment is taken. The real app would use a secure checkout such as Stripe or CanadaHelps, which issue tax receipts for registered charities.
        </p>
      </Card>
    </main>
  );
}

function impactText(impact: { amount: number; text: string }[], value: number) {
  const best = [...impact].reverse().find((i) => value >= i.amount);
  return best ? best.text : `helps toward ${impact[0].text}`;
}
