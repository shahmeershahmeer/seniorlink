"use client";

import { ArrowLeft, CircleCheck, Copy, Database, RefreshCw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui";
import type { AiCall } from "@/lib/aiLog";

type Log = { provider: "snowflake" | "claude" | "offline"; model: string | null; calls: AiCall[] };

const PROVIDER_LABEL = { snowflake: "Snowflake Cortex AI", claude: "Claude API (Anthropic)", offline: "Offline fallback (no AI connected)" };

const SQL = `-- Run in a Snowsight worksheet (ACCOUNTADMIN or a role with ACCOUNT_USAGE access).
-- New calls can take a little while to appear in ACCOUNT_USAGE.
SELECT start_time, request_id, model_name, tokens, tokens_granular
FROM SNOWFLAKE.ACCOUNT_USAGE.CORTEX_REST_API_USAGE_HISTORY
ORDER BY start_time DESC
LIMIT 25;`;

/** Proof page: every AI call SeniorLink made, which provider answered, and Snowflake's request ids. */
export default function AiActivityPage() {
  const router = useRouter();
  const [log, setLog] = useState<Log | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/ai-log", { cache: "no-store" });
    if (res.ok) setLog(await res.json());
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const calls = log?.calls ?? [];
  const ok = calls.filter((c) => c.ok);
  const tokens = ok.reduce((t, c) => t + (c.inputTokens ?? 0) + (c.outputTokens ?? 0), 0);
  const avgMs = ok.length ? Math.round(ok.reduce((t, c) => t + c.ms, 0) / ok.length) : 0;
  const snowflake = log?.provider === "snowflake";

  return (
    <main className="px-5 pb-12 pt-4">
      <button onClick={() => router.back()} className="-ml-3 flex h-12 items-center gap-1.5 rounded-full px-3 text-lg font-medium text-brand hover:bg-brand-soft">
        <ArrowLeft size={22} /> Back
      </button>
      <h1 className="mt-3 text-4xl font-semibold">AI activity</h1>
      <p className="mt-2 text-lg text-muted">Every AI call SeniorLink makes, and which service answered it.</p>

      <Card className={`mt-6 ${snowflake ? "bg-gradient-to-br from-sky-600 to-sky-800 text-white ring-0" : ""}`}>
        <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide opacity-90">
          <Database size={16} /> Powered by
        </p>
        <p className="mt-1 text-3xl font-semibold">{log ? PROVIDER_LABEL[log.provider] : "…"}</p>
        {log?.model && <p className="mt-1 text-lg opacity-90">Model: {log.model}</p>}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { n: calls.length, label: "AI calls" },
            { n: tokens.toLocaleString("en-CA"), label: "tokens" },
            { n: avgMs ? `${(avgMs / 1000).toFixed(1)} s` : "—", label: "avg time" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl py-3 ${snowflake ? "bg-white/15" : "bg-cream"}`}>
              <p className="text-2xl font-semibold">{s.n}</p>
              <p className="text-sm opacity-90">{s.label}</p>
            </div>
          ))}
        </div>
      </Card>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Recent calls</h2>
          <button onClick={load} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-base font-medium text-brand ring-2 ring-brand/30">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
        {calls.length === 0 ? (
          <Card>
            <p className="text-lg text-muted">No AI calls yet. Ask for help as Margaret, then come back.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {calls.slice(0, 40).map((c) => (
              <Card key={c.id} className="flex flex-col gap-1 p-4">
                <div className="flex items-center gap-2">
                  {c.ok ? <CircleCheck size={20} className="shrink-0 text-emerald-600" /> : <TriangleAlert size={20} className="shrink-0 text-amber-600" />}
                  <p className="flex-1 text-lg font-semibold">{c.feature}</p>
                  <span className="text-sm text-muted">{new Date(c.at).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", second: "2-digit" })}</span>
                </div>
                <p className="text-base">
                  {PROVIDER_LABEL[c.provider]}
                  {c.model ? ` · ${c.model}` : ""} · {(c.ms / 1000).toFixed(1)} s
                  {c.inputTokens != null ? ` · ${c.inputTokens} in / ${c.outputTokens} out tokens` : ""}
                </p>
                {c.requestId && (
                  <p className="break-all font-mono text-sm text-muted">
                    request_id: <span className="text-ink">{c.requestId}</span>
                  </p>
                )}
                {c.error && <p className="text-sm font-medium text-amber-800">{c.error}</p>}
              </Card>
            ))}
          </div>
        )}
      </section>

      <Card className="mt-6 flex flex-col gap-3">
        <p className="text-xl font-semibold">Check it in Snowflake</p>
        <p className="text-base text-muted">
          Snowflake logs every Cortex REST API call. The request ids above should appear in this view.
        </p>
        <div className="overflow-x-auto rounded-2xl bg-ink p-4">
          <pre className="text-sm leading-relaxed text-white">{SQL}</pre>
        </div>
        <button
          onClick={async () => {
            await navigator.clipboard?.writeText(SQL);
            setCopied(true);
          }}
          className="flex items-center justify-center gap-2 rounded-2xl py-3 text-lg font-semibold text-brand ring-2 ring-brand/40"
        >
          <Copy size={18} /> {copied ? "Copied" : "Copy SQL"}
        </button>
      </Card>
    </main>
  );
}
