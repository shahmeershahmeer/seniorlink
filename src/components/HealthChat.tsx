"use client";

import { Mic, Phone, Send, ShieldAlert, ShoppingBag, Stethoscope, TriangleAlert, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { post } from "@/components/useAppState";
import { speak, useSpeech } from "@/components/useSpeech";
import { addDays, aiLabel } from "@/lib/format";
import type { HealthReply, HealthSuggestion, Senior } from "@/lib/types";

type Msg = { role: "user"; content: string } | { role: "assistant"; content: string; data: HealthReply };

const STARTERS = [
  "I have a mild headache. What can I take?",
  "Can I take ibuprofen with my pills?",
  "I'm not sleeping well lately.",
  "What is my metformin for?",
];

const LEVEL: Record<HealthReply["level"], { label: string; className: string } | null> = {
  emergency: { label: "Emergency", className: "bg-red-700 text-white" },
  urgent: { label: "Get advice today", className: "bg-amber-500 text-white" },
  see_doctor: { label: "See your doctor", className: "bg-sky-100 text-sky-900" },
  self_care: { label: "Self-care", className: "bg-emerald-100 text-emerald-900" },
  info: null,
};

export default function HealthChat({
  senior,
  onRefresh,
  provider,
}: {
  senior: Senior;
  onRefresh: () => void;
  provider?: "snowflake" | "claude" | "offline";
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const speech = useSpeech("en-CA");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  async function send(content: string) {
    const q = content.trim();
    if (!q || thinking) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setText("");
    setThinking(true);
    try {
      const data = await post<HealthReply>("/api/health-chat", {
        seniorId: senior.id,
        messages: next.map((m) => ({ role: m.role, content: m.content })),
      });
      setMessages([...next, { role: "assistant", content: data.reply, data }]);
    } catch {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: "I can't connect right now. Call Tele-Care 811 for nurse advice, or 911 in an emergency.",
          data: { reply: "", level: "info", suggestions: [], interactionWarning: null, source: "offline" },
        },
      ]);
    }
    setThinking(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-3 text-4xl font-semibold leading-tight">
          <Stethoscope size={34} className="text-brand" aria-hidden /> Ask about your health
        </h1>
        <p className="mt-2 text-lg text-muted">
          General health information from {aiLabel(provider)}. It knows your medicine list, but it isn&apos;t a doctor and can&apos;t diagnose.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <a href="tel:911" className="flex items-center justify-center gap-2 rounded-2xl bg-red-700 py-3 text-lg font-semibold text-white">
          <Phone size={20} /> Emergency 911
        </a>
        <a href="tel:811" className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3 text-lg font-semibold text-brand ring-2 ring-brand">
          <Phone size={20} /> Nurse line 811
        </a>
      </div>

      {messages.length === 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-base font-medium text-muted">Try asking:</p>
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-2xl bg-white px-4 py-3 text-left text-lg ring-1 ring-black/10 hover:ring-brand"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-10 self-end rounded-3xl rounded-br-lg bg-brand px-5 py-3 text-lg text-white">
              {m.content}
            </div>
          ) : (
            <AssistantMessage key={i} msg={m} senior={senior} onRefresh={onRefresh} />
          ),
        )}
        {thinking && (
          <div className="flex items-center gap-2 self-start rounded-3xl bg-white px-5 py-4 ring-1 ring-black/5">
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand [animation-delay:-0.3s]" />
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand [animation-delay:-0.15s]" />
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand" />
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="sticky bottom-[88px] z-10 -mx-1 flex gap-2 rounded-3xl bg-cream/95 p-1 backdrop-blur"
      >
        {speech.supported && (
          <button
            type="button"
            onClick={() => (speech.listening ? speech.stop() : speech.start(send))}
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${speech.listening ? "animate-pulse bg-accent text-white" : "bg-white text-brand ring-2 ring-sand"}`}
            aria-label={speech.listening ? "Stop listening" : "Speak your question"}
          >
            <Mic size={24} />
          </button>
        )}
        <input
          value={speech.listening ? speech.transcript : text}
          onChange={(e) => setText(e.target.value)}
          placeholder={speech.listening ? "Listening…" : "Type your question"}
          className="min-w-0 flex-1 rounded-2xl border-2 border-sand bg-white px-4 text-lg outline-none focus:border-brand"
        />
        <button
          disabled={!text.trim() || thinking}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand text-white disabled:opacity-40"
          aria-label="Send"
        >
          <Send size={22} />
        </button>
      </form>
    </div>
  );
}

function AssistantMessage({
  msg,
  senior,
  onRefresh,
}: {
  msg: Extract<Msg, { role: "assistant" }>;
  senior: Senior;
  onRefresh: () => void;
}) {
  const { data } = msg;
  const level = LEVEL[data.level];

  if (data.level === "emergency") {
    return (
      <div className="pop-in flex flex-col gap-3 rounded-3xl bg-red-700 p-5 text-white">
        <p className="flex items-center gap-2 text-2xl font-semibold">
          <ShieldAlert size={28} /> Call 911 now
        </p>
        <p className="text-lg">{msg.content}</p>
        <a href="tel:911" className="rounded-2xl bg-white py-4 text-center text-2xl font-semibold text-red-700">
          Call 911
        </a>
      </div>
    );
  }

  return (
    <div className="pop-in mr-4 flex flex-col gap-3 self-start rounded-3xl rounded-bl-lg bg-white p-5 ring-1 ring-black/5">
      <div className="flex items-center gap-2">
        {level && <span className={`rounded-full px-3 py-1 text-sm font-medium ${level.className}`}>{level.label}</span>}
        <button onClick={() => speak(msg.content, "en-CA")} className="ml-auto rounded-full p-2 text-brand hover:bg-brand-soft" aria-label="Read aloud">
          <Volume2 size={22} />
        </button>
      </div>
      <p className="whitespace-pre-line text-lg leading-relaxed">{msg.content}</p>

      {data.level === "urgent" && (
        <a href="tel:811" className="flex items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3 text-lg font-semibold text-white">
          <Phone size={20} /> Call Tele-Care 811
        </a>
      )}

      {data.interactionWarning && (
        <div className="flex gap-3 rounded-2xl bg-amber-50 p-4 text-base text-amber-950 ring-1 ring-amber-200">
          <TriangleAlert size={22} className="mt-0.5 shrink-0 text-amber-600" aria-hidden />
          <p>
            <span className="font-semibold">With your medicines: </span>
            {data.interactionWarning}
          </p>
        </div>
      )}

      {data.suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-base font-semibold text-muted">Things that may help</p>
          {data.suggestions.map((s) => (
            <SuggestionCard key={s.name} s={s} senior={senior} onRefresh={onRefresh} />
          ))}
          <p className="text-sm text-muted">Check with your pharmacist before taking anything new. They know your medicines.</p>
        </div>
      )}
    </div>
  );
}

/** Looks like something you'd buy (a medicine or product), rather than a home measure such as "rest". */
function isProduct(name: string) {
  return /\(|acetaminophen|tylenol|lozenge|spray|drops|cream|ointment|tablet|syrup|antacid|saline|melatonin|loratadine|cetirizine/i.test(name);
}

function SuggestionCard({ s, senior, onRefresh }: { s: HealthSuggestion; senior: Senior; onRefresh: () => void }) {
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");

  async function pickUp() {
    setState("busy");
    await post("/api/requests", {
      seniorId: senior.id,
      drafts: [
        {
          taskType: "pharmacy",
          title: "Pharmacy pickup",
          details: `Pick up ${s.name} from the pharmacy. Please ask the pharmacist to confirm it's safe with my other medicines.`,
          date: addDays(0),
          timeLabel: "Any time",
          timeWindow: "anytime",
          location: senior.address,
          destination: "Nearest pharmacy",
          urgency: "low",
          accessibility: null,
          shoppingList: [{ id: "item0", name: s.name, qty: 1, kind: "otc" }],
          payment: "pay_back",
        },
      ],
    });
    onRefresh();
    setState("sent");
  }

  return (
    <div className="rounded-2xl bg-cream p-4">
      <p className="text-lg font-semibold">{s.name}</p>
      <p className="text-base">{s.why}</p>
      <p className="mt-1 text-sm text-amber-900">{s.caution}</p>
      {isProduct(s.name) &&
        (state === "sent" ? (
          <p className="mt-2 text-base font-medium text-emerald-800">Pickup requested. A volunteer will ask the pharmacist to check it.</p>
        ) : (
          <button
            onClick={pickUp}
            disabled={state === "busy"}
            className="mt-2 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-base font-medium text-brand ring-2 ring-brand/40 disabled:opacity-50"
          >
            <ShoppingBag size={18} /> {state === "busy" ? "Requesting…" : "Ask a volunteer to pick this up"}
          </button>
        ))}
    </div>
  );
}
