// In-memory record of every AI call, shown on the /ai page as proof of which provider answered.

export interface AiCall {
  id: string;
  at: number;
  feature: string;
  provider: "snowflake" | "claude" | "offline";
  model: string | null;
  requestId: string | null; // Snowflake request id — matches CORTEX_REST_API_USAGE_HISTORY.REQUEST_ID
  inputTokens: number | null;
  outputTokens: number | null;
  ms: number;
  ok: boolean;
  error?: string;
}

const g = globalThis as unknown as { __seniorlinkAiLog?: AiCall[] };
const log = (g.__seniorlinkAiLog ??= []);

export function recordAiCall(call: Omit<AiCall, "id">) {
  log.unshift({ ...call, id: Math.random().toString(36).slice(2, 10) });
  if (log.length > 200) log.length = 200;
}

export function aiCalls(): AiCall[] {
  return log;
}
