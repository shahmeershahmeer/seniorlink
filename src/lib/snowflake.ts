import { z } from "zod";

// Snowflake Cortex AI via the Cortex REST API (OpenAI-compatible Chat Completions).
// Docs: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api
//
// Environment:
//   SNOWFLAKE_ACCOUNT  account identifier, e.g. "myorg-myaccount" (or set SNOWFLAKE_HOST to the full host)
//   SNOWFLAKE_PAT      programmatic access token (Snowsight → Settings → Authentication)
//   SNOWFLAKE_MODEL    optional, default "claude-sonnet-4-5" (any Cortex model available in your region)
//
// The user's default role needs SNOWFLAKE.CORTEX_USER or SNOWFLAKE.CORTEX_REST_API_USER.

export type ChatMessage = { role: "user" | "assistant"; content: string };

const MODEL = process.env.SNOWFLAKE_MODEL || "claude-sonnet-4-5";

function host(): string | null {
  if (process.env.SNOWFLAKE_HOST) return process.env.SNOWFLAKE_HOST.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const account = process.env.SNOWFLAKE_ACCOUNT?.trim();
  // Account identifiers use underscores; hostnames must use hyphens.
  return account ? `${account.toLowerCase().replace(/_/g, "-")}.snowflakecomputing.com` : null;
}

export function snowflakeConfigured(): boolean {
  const token = process.env.SNOWFLAKE_PAT ?? "";
  return Boolean(host()) && token.length > 20 && !token.includes("...");
}

/**
 * Cortex structured outputs need plain JSON Schema. OpenAI-family models additionally require
 * `additionalProperties: false` and every property listed in `required` on every object, and
 * nullable values are expressed as `type: ["string", "null"]`. This produces a schema every
 * Cortex model family accepts.
 */
function cortexSchema(schema: z.ZodType): Record<string, unknown> {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const n = { ...(node as Record<string, unknown>) };
    delete n.$schema;

    // anyOf: [X, {type: "null"}] → X with type [X.type, "null"]
    if (Array.isArray(n.anyOf) && n.anyOf.length === 2) {
      const [a, b] = n.anyOf as Record<string, unknown>[];
      const nonNull = a?.type === "null" ? b : b?.type === "null" ? a : null;
      if (nonNull && typeof nonNull.type === "string") {
        const merged = walk(nonNull) as Record<string, unknown>;
        return { ...merged, type: [nonNull.type, "null"] };
      }
    }

    for (const [k, v] of Object.entries(n)) n[k] = walk(v);
    if (n.type === "object" && n.properties && typeof n.properties === "object") {
      n.additionalProperties = false;
      n.required = Object.keys(n.properties);
    }
    return n;
  };
  return walk(z.toJSONSchema(schema)) as Record<string, unknown>;
}

/** Pulls the JSON object out of a reply, tolerating ```json fences or stray prose around it. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(body.slice(start, end + 1));
    throw new Error("Reply was not JSON");
  }
}

/**
 * Asks a Cortex model for a JSON answer matching `schema`.
 * Returns null on any failure so callers fall back to the offline logic.
 */
export interface CallMeta {
  model: string | null;
  requestId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  error?: string;
}

export async function askSnowflake<T>(
  system: string,
  messages: ChatMessage[],
  schema: z.ZodType<T>,
  meta: CallMeta = { model: MODEL, requestId: null, inputTokens: null, outputTokens: null },
): Promise<T | null> {
  const h = host();
  meta.model = MODEL;
  if (!h || !snowflakeConfigured()) return null;
  try {
    const res = await fetch(`https://${h}/api/v2/cortex/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${process.env.SNOWFLAKE_PAT}`,
        "X-Snowflake-Authorization-Token-Type": "PROGRAMMATIC_ACCESS_TOKEN",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: system }, ...messages],
        max_completion_tokens: 4000,
        stream: false,
        response_format: {
          type: "json_schema",
          json_schema: { name: "seniorlink_result", schema: cortexSchema(schema) },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    meta.requestId = res.headers.get("x-snowflake-request-id") ?? res.headers.get("x-request-id");
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 400);
      meta.error = `HTTP ${res.status}`;
      if (res.status === 401 || res.status === 403) {
        console.error(`[ai] Snowflake rejected the token (${res.status}). Check SNOWFLAKE_PAT, the role's Cortex grant, and network policy. ${detail}`);
      } else if (res.status === 400 && /model/i.test(detail)) {
        console.error(`[ai] Snowflake model "${MODEL}" unavailable in this region? Set SNOWFLAKE_MODEL or enable cross-region inference. ${detail}`);
      } else {
        console.error(`[ai] Snowflake Cortex error ${res.status}: ${detail}`);
      }
      return null;
    }

    const data = await res.json();
    meta.model = data?.model ?? MODEL;
    meta.requestId = data?.id ?? meta.requestId;
    meta.inputTokens = data?.usage?.prompt_tokens ?? null;
    meta.outputTokens = data?.usage?.completion_tokens ?? null;
    const content = data?.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((c: { text?: string }) => c.text ?? "").join("") : "";
    if (!text) {
      meta.error = "Empty reply";
      console.error("[ai] Snowflake returned an empty reply");
      return null;
    }
    const parsed = schema.safeParse(extractJson(text));
    if (!parsed.success) {
      meta.error = "Reply didn't match schema";
      console.error("[ai] Snowflake reply didn't match the expected shape", parsed.error.issues.slice(0, 3));
      return null;
    }
    return parsed.data;
  } catch (err) {
    meta.error = err instanceof Error ? err.message : "Request failed";
    console.error("[ai] Snowflake request failed", err instanceof Error ? err.message : err);
    return null;
  }
}

export const SNOWFLAKE_MODEL = MODEL;
