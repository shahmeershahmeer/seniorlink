import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { TASKS, WINDOWS, dateLabel, familyTitle, firstName, isoDate } from "./format";
import { looksLikeEmergency, offlineParse } from "./offlineParser";
import { formatPhone, offlineAnalysis } from "./scams";
import type { ActivityEvent, Draft, FamilyLink, HealthReply, HourLog, Medication, ScamAnalysis, ScamCampaign, ScamChannel, ScamReport, Volunteer, HelpRequest, ParseResult, Senior, TaskType, TimeWindow, Urgency } from "./types";
import type { Match } from "./matching";
import { recordAiCall } from "./aiLog";
import { SNOWFLAKE_MODEL, askSnowflake, snowflakeConfigured, type CallMeta, type ChatMessage } from "./snowflake";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";

// Which AI powers SeniorLink. Snowflake Cortex is used whenever it's configured.
// AI_PROVIDER=snowflake → Snowflake only (never Claude); AI_PROVIDER=claude → Claude only.
// If the chosen provider isn't configured, offline fallbacks run.
function claudeConfigured(): boolean {
  const key = process.env.ANTHROPIC_API_KEY ?? "";
  return key.startsWith("sk-ant-") && key.length > 30; // ignore the placeholder
}

export function aiProvider(): "snowflake" | "claude" | "offline" {
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase();
  // Snowflake-only: never fall back to Claude, even if a Claude key is present.
  if (forced === "snowflake") return snowflakeConfigured() ? "snowflake" : "offline";
  if (forced === "claude") return claudeConfigured() ? "claude" : "offline";
  if (snowflakeConfigured()) return "snowflake";
  if (claudeConfigured()) return "claude";
  return "offline";
}

export function aiEnabled(): boolean {
  return aiProvider() !== "offline";
}

/**
 * Every AI feature goes through here: a system prompt, the conversation, and the exact
 * shape of answer we need. Returns null on failure so callers use their offline fallback.
 */
async function askAI<T>(
  feature: string,
  system: string,
  user: string | ChatMessage[],
  schema: z.ZodType<T>,
  effort: "low" | "medium" = "low",
): Promise<T | null> {
  const messages: ChatMessage[] = typeof user === "string" ? [{ role: "user", content: user }] : user;
  const provider = aiProvider();
  const meta: CallMeta = { model: null, requestId: null, inputTokens: null, outputTokens: null };
  const started = Date.now();
  let result: T | null = null;
  if (provider === "snowflake") result = await askSnowflake(system, messages, schema, meta);
  else if (provider === "claude") {
    meta.model = MODEL;
    result = await askClaude(system, messages, schema, effort);
  }
  recordAiCall({
    at: started,
    feature,
    provider,
    ...meta,
    ms: Date.now() - started,
    ok: result !== null,
    ...(provider !== "offline" && result === null && !meta.error && { error: "Failed, used offline fallback" }),
  });
  return result ? fixEscapes(result) : null;
}

export function aiModelName(): string | null {
  const p = aiProvider();
  return p === "snowflake" ? SNOWFLAKE_MODEL : p === "claude" ? MODEL : null;
}

let client: Anthropic | null = null;

/** Models occasionally emit literal "\\u2014"-style escapes inside strings; turn them back into characters. */
function fixEscapes<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))) as T;
  }
  if (Array.isArray(value)) return value.map(fixEscapes) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fixEscapes(v)])) as T;
  }
  return value;
}

/**
 * Direct Claude API (Anthropic), used when AI_PROVIDER=claude or Snowflake isn't configured.
 * Returns null on any failure or refusal so callers fall back to the offline logic.
 */
async function askClaude<T>(
  system: string,
  messages: ChatMessage[],
  schema: z.ZodType<T>,
  effort: "low" | "medium" = "low",
): Promise<T | null> {
  if (!claudeConfigured()) return null;
  client ??= new Anthropic({ timeout: 20_000, maxRetries: 1 });
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system,
      messages,
      // Simple extraction runs at low effort to keep the demo snappy; health answers get more care.
      output_config: { effort, format: zodOutputFormat(schema) },
    });
    if (response.stop_reason === "refusal") {
      console.warn("[ai] Claude declined; using offline fallback");
      return null;
    }
    return response.parsed_output ?? null;
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) console.error("[ai] Invalid ANTHROPIC_API_KEY");
    else if (err instanceof Anthropic.RateLimitError) console.error("[ai] Rate limited");
    else if (err instanceof Anthropic.APIError) console.error(`[ai] API error ${err.status}:`, err.message);
    else console.error("[ai] request failed", err);
    return null;
  }
}

// ---------- 1. Request understanding (+ combining + emergency guardrail) ----------

const TASK_TYPES: TaskType[] = ["groceries", "pharmacy", "ride", "snow", "other"];
const TIME_WINDOWS: TimeWindow[] = ["morning", "afternoon", "evening", "anytime"];
const URGENCIES: Urgency[] = ["low", "medium", "high"];

const ParseSchema = z.object({
  emergency: z.boolean(),
  tasks: z.array(
    z.object({
      taskType: z.enum(["groceries", "pharmacy", "ride", "snow", "other"]),
      title: z.string(),
      details: z.string(),
      date: z.string(),
      timeLabel: z.string(),
      timeWindow: z.enum(["morning", "afternoon", "evening", "anytime"]),
      location: z.string(),
      destination: z.string().nullable(),
      urgency: z.enum(["low", "medium", "high"]),
      accessibility: z.string().nullable(),
      appointmentTime: z.string().nullable(),
      roundTrip: z.boolean(),
      shoppingList: z.array(z.object({ name: z.string(), qty: z.number(), kind: z.enum(["prescription", "otc", "grocery"]) })),
    }),
  ),
  combine: z.object({ suggest: z.boolean(), message: z.string() }),
  reply: z.string(),
});

function parsePrompt(senior: Senior): string {
  const now = new Date();
  const weekday = now.toLocaleDateString("en-CA", { weekday: "long" });
  return `You are the request-understanding engine for SeniorLink, a community app in Fredericton, New Brunswick, Canada that connects seniors with trusted local volunteers for everyday errands.

Your ONLY job is coordination: turn what the senior says into structured help requests.
Never give medical advice, never diagnose, never comment on anyone's health.

Today is ${weekday}, ${isoDate(now)}. The senior is ${senior.name}; home address: ${senior.address}.
The senior may speak English or French.

Respond with these fields:
{
  "emergency": boolean,   // true ONLY if they describe an immediate danger or medical emergency (chest pain, a fall they can't get up from, trouble breathing, etc.)
  "tasks": [ {
      "taskType": one of ${JSON.stringify(TASK_TYPES)},
      "title": short title in the senior's language, e.g. "Prescription pickup",
      "details": one plain sentence describing what the volunteer should do,
      "date": "YYYY-MM-DD" (resolve words like "tomorrow" or "Thursday"; if no date is given use today),
      "timeLabel": human-friendly time, e.g. "Afternoon", "10:00 AM", "4–6 PM", or "Any time",
      "timeWindow": one of ${JSON.stringify(TIME_WINDOWS)} (morning < 12:00, afternoon 12–17, evening > 17),
      "location": where the volunteer meets the senior — default to the home address; for rides use the pickup place,
      "destination": where the volunteer goes (store, pharmacy, clinic, city) or null,
      "urgency": one of ${JSON.stringify(URGENCIES)},
      "accessibility": any mobility or accessibility need mentioned (walker, wheelchair, hard of hearing...) or null,
      "appointmentTime": for rides, the appointment time as "HH:MM" 24h if given, else null,
      "roundTrip": for rides, true if they need a ride back home afterwards ("and back", "bring me home"), else false,
      "shoppingList": for groceries, each item they named as {"name", "qty", "kind": "grocery"} (e.g. "a dozen eggs" → {"name": "Eggs (dozen)", "qty": 1}). For pharmacy, each item with kind "prescription" (e.g. "my prescription", "my blood pressure pills" → name it the way they said it) or "otc" for over-the-counter products (e.g. "Tylenol"). Empty list otherwise
  } ],
  "combine": { "suggest": boolean, "message": string },  // suggest=true when 2+ errands could reasonably be done in ONE trip (e.g. groceries + prescription); message is one friendly sentence offering to combine them
  "reply": one warm, short sentence reading the request back to the senior in THEIR language, phrased as what you WILL do once they confirm (e.g. "I'll ask a trusted neighbour to...") — nothing is arranged yet — ending with a yes/no question like "Is that right?"
}
Use one task per distinct errand. If emergency is true, tasks may be empty.`;
}

function clean(
  d: Partial<Omit<Draft, "shoppingList">> & { shoppingList?: { name: string; qty: number; kind?: string }[] },
  senior: Senior,
): Draft {
  const taskType = TASK_TYPES.includes(d.taskType as TaskType) ? (d.taskType as TaskType) : "other";
  const timeWindow = TIME_WINDOWS.includes(d.timeWindow as TimeWindow) ? (d.timeWindow as TimeWindow) : "anytime";
  return {
    taskType,
    title: d.title?.trim() || TASKS[taskType].label,
    details: d.details?.trim() || "",
    date: /^\d{4}-\d{2}-\d{2}$/.test(d.date ?? "") ? d.date! : isoDate(new Date()),
    timeLabel: d.timeLabel?.trim() || (timeWindow === "anytime" ? "Any time" : WINDOWS[timeWindow]),
    timeWindow,
    location: d.location?.trim() || senior.address,
    destination: d.destination || null,
    urgency: URGENCIES.includes(d.urgency as Urgency) ? (d.urgency as Urgency) : "medium",
    accessibility: d.accessibility || null,
    appointmentTime: /^\d{2}:\d{2}$/.test(d.appointmentTime ?? "") ? d.appointmentTime : null,
    roundTrip: Boolean(d.roundTrip),
    shoppingList: (d.shoppingList ?? [])
      .filter((i) => i?.name?.trim())
      .map((i, n) => ({
        id: `item${n}`,
        name: i.name.trim(),
        qty: Math.max(1, Math.round(Number(i.qty) || 1)),
        ...(taskType === "pharmacy" && { kind: i.kind === "otc" ? ("otc" as const) : ("prescription" as const) }),
      })),
  };
}

export async function parseRequest(text: string, senior: Senior): Promise<ParseResult> {
  // Guardrail runs locally first: never wait on the network for an emergency.
  if (looksLikeEmergency(text)) return offlineParse(text, senior);

  const ai = await askAI("Request understanding", parsePrompt(senior), text, ParseSchema);

  if (!ai || (!ai.emergency && !ai.tasks?.length)) return offlineParse(text, senior);

  const tasks = (ai.tasks ?? []).map((t) => clean(t, senior));
  return {
    emergency: Boolean(ai.emergency),
    tasks,
    combine: {
      suggest: tasks.length > 1 && Boolean(ai.combine?.suggest),
      message: ai.combine?.message ?? "",
    },
    reply: ai.reply ?? "",
    source: "ai",
  };
}

// ---------- 2. Match explainer ----------

export async function explainMatch(req: HelpRequest, m: Match): Promise<string> {
  const v = m.volunteer;
  const done = v.taskCounts[req.taskType] ?? 0;
  const fallback =
    `${firstName(v.name)} lives ${m.km.toFixed(1)} km away` +
    (req.timeWindow !== "anytime" && v.availability.includes(req.timeWindow)
      ? `, is free ${dateLabel(req.date).toLowerCase()} ${req.timeWindow}`
      : "") +
    (done ? `, and has done ${done} ${TASKS[req.taskType].noun} tasks` : "") +
    ` with a ${v.rating.toFixed(1)} rating.`;

  const facts = {
    volunteer: firstName(v.name),
    distance_km: Number(m.km.toFixed(1)),
    verified: v.verified,
    rating: v.rating,
    similar_tasks_done: done,
    total_tasks_done: v.tasksCompleted,
    organization: v.org ?? null,
    available_windows: v.availability,
    request: { task: req.title, when: `${dateLabel(req.date)} ${req.timeLabel}` },
  };
  const ai = await askAI(
    "Match explainer",
    `You write for SeniorLink, a community help app for seniors. Write ONE warm, plain-language sentence (max 30 words) telling an older adult why this volunteer is a good match for their request. Use only the facts given; do not invent anything.`,
    JSON.stringify(facts),
    z.object({ sentence: z.string() }),
  );
  return ai?.sentence?.trim() || fallback;
}

// ---------- 3. Family summary ----------

export async function familySummary(
  senior: Senior,
  viewer: FamilyLink,
  requests: HelpRequest[],
  activity: ActivityEvent[],
  volunteerName: (id?: string) => string,
): Promise<{ summary: string; source: "ai" | "offline" }> {
  const weekAgo = Date.now() - 7 * 86_400_000;
  const recent = requests.filter((r) => r.createdAt >= weekAgo && r.status !== "cancelled");
  const completed = recent.filter((r) => r.status === "completed");
  const upcoming = recent.filter((r) => r.status !== "completed");
  const lastActivity = activity[0]?.at;

  const fallback =
    `${viewer.callsThem} made ${recent.length} request${recent.length === 1 ? "" : "s"} this week` +
    (completed.length ? `, and ${completed.length} ${completed.length === 1 ? "was" : "were"} completed by local volunteers` : "") +
    "." +
    (upcoming.length
      ? ` Coming up: ${upcoming.map((r) => `${familyTitle(r).toLowerCase()} (${dateLabel(r.date).toLowerCase()})`).join(", ")}.`
      : " Nothing is scheduled right now.");

  const facts = {
    senior_first_name: senior.firstName,
    family_member: viewer.name,
    family_member_calls_senior: viewer.callsThem,
    requests_this_week: recent.map((r) => ({
      task: familyTitle(r),
      date: dateLabel(r.date),
      time: r.timeLabel,
      status: r.status,
      volunteer: r.volunteerId ? volunteerName(r.volunteerId) : null,
    })),
    days_since_last_activity: lastActivity ? Math.floor((Date.now() - lastActivity) / 86_400_000) : null,
  };

  const ai = await askAI(
    "Family summary",
    `You write short weekly updates for SeniorLink, a community errand-help app. A family member (with the senior's permission) reads this. Write 2–3 warm, reassuring sentences summarising the senior's SeniorLink activity: what was completed, by whom, and anything upcoming. Use ONLY the facts provided. Never speculate about health, mood or medical matters. Write natural sentences with ordinary punctuation (commas and full stops; never spell out punctuation as words). Address the family member by first name and refer to the senior the way they do (family_member_calls_senior, e.g. "Mom").`,
    JSON.stringify(facts),
    z.object({ summary: z.string() }),
  );
  return ai?.summary ? { summary: ai.summary.trim(), source: "ai" } : { summary: fallback, source: "offline" };
}


// ---------- 4. Volunteer impact statement (for co-curricular records, résumés) ----------

export async function impactStatement(
  v: Volunteer,
  logs: HourLog[],
  orgName?: string,
): Promise<{ statement: string; source: "ai" | "offline" }> {
  const hours = logs.reduce((t, l) => t + l.hours, 0);
  const byType: Partial<Record<TaskType, number>> = {};
  for (const l of logs) byType[l.taskType] = (byType[l.taskType] ?? 0) + 1;
  const seniors = new Set(logs.map((l) => l.seniorFirstName)).size;
  const first = logs.length ? new Date(Math.min(...logs.map((l) => l.at))) : new Date();
  const since = first.toLocaleDateString("en-CA", { month: "long", year: "numeric" });
  const top = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => TASKS[t as TaskType].noun);

  const fallback =
    `Since ${since}, I have volunteered ${Math.round(hours)} hours with SeniorLink in Fredericton, completing ${logs.length} ` +
    `tasks for ${seniors} older adults in my community, mostly ${top.join(", ")} support. ` +
    `This work helped seniors stay independent at home, and taught me to communicate with patience, show up reliably, ` +
    `and coordinate with neighbours I had never met before.`;

  const facts = {
    volunteer_first_name: firstName(v.name),
    confirmed_hours: hours,
    tasks_completed: logs.length,
    seniors_helped: seniors,
    tasks_by_type: byType,
    volunteering_since: since,
    city: "Fredericton, New Brunswick",
    verified_volunteer: v.verified,
    audience: orgName ?? "a co-curricular record or résumé",
  };

  const ai = await askAI(
    "Impact statement",
    `You help volunteers on SeniorLink (a Fredericton community app connecting seniors with volunteers for errands, rides and check-ins) describe their work for academic credit and résumés. Write a first-person impact statement of 3–4 sentences (max 90 words) suitable for the given audience. State the concrete facts provided (hours, tasks, people helped), then name two or three transferable skills the work plausibly built. Use only the facts given; never invent numbers, names or outcomes. Plain, professional, warm Canadian English.`,
    JSON.stringify(facts),
    z.object({ statement: z.string() }),
  );
  return ai?.statement ? { statement: ai.statement.trim(), source: "ai" } : { statement: fallback, source: "offline" };
}

// ---------- 5. Health assistant (general information with guardrails) ----------

const HealthSchema = z.object({
  reply: z.string(),
  level: z.enum(["emergency", "urgent", "see_doctor", "self_care", "info"]),
  suggestions: z.array(z.object({ name: z.string(), why: z.string(), caution: z.string() })),
  interactionWarning: z.string().nullable(),
});

function healthPrompt(senior: Senior, meds: Medication[]): string {
  const medList = meds.length
    ? meds.map((m) => `- ${m.name} ${m.dose}${m.purpose ? ` (${m.purpose})` : ""}, taken at ${m.times.join(", ")}`).join("\n")
    : "- (none recorded)";
  return `You are the SeniorLink Health Assistant, talking with ${senior.firstName}, an older adult living in ${senior.area}, New Brunswick, Canada.
You give clear, kind, general health information. You are not a doctor and cannot examine anyone, so you never diagnose.

Their current medications (from their SeniorLink list):
${medList}

How to respond:
- Plain language, short sentences, no jargon. At most about 120 words in "reply". Ask one clarifying question when it would genuinely change your advice.
- Set "level":
  - "emergency": signs of a possible emergency (chest pain or pressure, trouble breathing, stroke signs such as face drooping, arm weakness or slurred speech, severe bleeding, fainting, a fall with injury, sudden confusion, thoughts of self-harm). Tell them to call 911 now. No suggestions.
  - "urgent": needs a health professional today but is not an emergency. Recommend calling Tele-Care 811 (New Brunswick's free 24/7 nurse line) or seeing a doctor today.
  - "see_doctor": should book an appointment with their family doctor or nurse practitioner soon.
  - "self_care": minor issue that is usually managed at home.
  - "info": a general question.
- "suggestions": only for "self_care", and only well-known over-the-counter options or simple home measures (e.g. acetaminophen, saline spray, rest and fluids). Never prescription drugs, never antibiotics, never advice to start, stop or change a prescribed medicine. Give no doses beyond "follow the package directions". Each suggestion needs a one-line "caution" relevant to an older adult. Use an empty list otherwise.
- Always check suggestions against their medication list. Older adults are sensitive to NSAIDs such as ibuprofen and naproxen (kidneys, stomach bleeding, blood pressure), to sedating antihistamines such as diphenhydramine (falls, confusion), and to decongestants when they have high blood pressure. If anything could interact with or affect one of their medicines or conditions, explain it plainly in "interactionWarning"; otherwise null.
- Whenever you mention any medicine, remind them to check with their pharmacist first, since pharmacists can confirm it is safe with their other medicines.
- If they ask about something unrelated to health, gently steer back.`;
}

export async function healthChat(
  senior: Senior,
  meds: Medication[],
  history: { role: "user" | "assistant"; content: string }[],
): Promise<HealthReply> {
  const last = history[history.length - 1]?.content ?? "";

  // The emergency check runs locally first, so it never waits on the network.
  if (looksLikeEmergency(last)) {
    return {
      reply: "This could be an emergency. Please call 911 now. If you can, unlock your door and sit somewhere safe while you wait.",
      level: "emergency",
      suggestions: [],
      interactionWarning: null,
      source: "offline",
    };
  }

  // Keep the last few turns; the API requires the conversation to start with a user message.
  const recent = history.slice(-12);
  while (recent.length && recent[0].role !== "user") recent.shift();
  const ai = await askAI("Health assistant", healthPrompt(senior, meds), recent, HealthSchema, "medium");
  if (ai) return { ...ai, source: "ai" };

  return {
    reply:
      "I can't connect right now. For health advice any time, call Tele-Care 811 to speak with a registered nurse, free and 24/7. If this is an emergency, call 911.",
    level: "info",
    suggestions: [],
    interactionWarning: null,
    source: "offline",
  };
}

// ---------- 6. Scam Watch: analyse a report, write campaign alerts ----------

const SCAM_CATEGORIES = [
  "grandparent", "utility", "government", "bank", "delivery", "tech_support",
  "romance", "investment", "prize", "phishing", "other",
] as const;

const ScamSchema = z.object({
  verdict: z.enum(["likely_scam", "suspicious", "probably_safe"]),
  category: z.enum(SCAM_CATEGORIES),
  impersonating: z.string().nullable(),
  tactics: z.array(z.string()),
  title: z.string(),
  summary: z.string(),
  advice: z.string(),
});

export async function analyzeScam(text: string, channel: ScamChannel): Promise<ScamAnalysis> {
  // Phone numbers, domains, emails and payment methods always come from deterministic extraction,
  // so they can be matched exactly across reports and are never invented by the model.
  const offline = offlineAnalysis(text);
  const ai = await askAI(
    "Scam analysis",
    `You analyse scam reports for SeniorLink Scam Watch, a community safety tool for older adults in Fredericton, New Brunswick.
Given what someone experienced (via ${channel}), return:
- verdict: likely_scam / suspicious / probably_safe.
- category: grandparent (family-emergency or "it's me" calls, including AI voice clones), utility (e.g. NB Power), government (CRA, Service Canada, SIN, arrest warrants), bank (fake fraud department / bank investigator), delivery (Canada Post or courier texts), tech_support, romance, investment (incl. crypto), prize, phishing (credential or link phishing not covered above), other.
- impersonating: the organization or person the scammer pretends to be, in a short canonical form ("NB Power", "CRA", "Canada Post", "A grandchild", "A bank"), or null.
- tactics: 1–4 short lowercase pressure tactics used, from: urgency, secrecy, threats, promise of money, remote access, unusual payment, emotional manipulation, spoofed caller ID.
- title: a short neutral campaign-style title, max 7 words, e.g. "Fake NB Power disconnection calls".
- summary: one sentence describing the scam itself. Remove anything that identifies the person reporting (their name, address, account numbers, family names).
- advice: 1–2 plain sentences for an older adult on what to do now. If they may have paid or shared details, tell them to call their bank right away and report to the Canadian Anti-Fraud Centre (1-888-495-8501).`,
    text,
    ScamSchema,
  );
  return ai ? { ...ai, indicators: offline.indicators, source: "ai" } : offline;
}

const AlertSchema = z.object({
  title: z.string(),
  summary: z.string(),
  howToSpot: z.array(z.string()),
  whatToDo: z.array(z.string()),
});

export async function writeScamAlert(c: ScamCampaign, reports: ScamReport[]): Promise<ScamCampaign["alert"] | null> {
  const facts = {
    category: c.category,
    impersonating: c.impersonating,
    reports: reports.map((r) => ({ channel: r.channel, summary: r.analysis.summary, tactics: r.analysis.tactics })),
    phone_numbers_used: c.indicators.phones.map(formatPhone),
    websites_used: c.indicators.domains,
    payment_methods_requested: c.indicators.payments,
    areas: c.areas,
    people_who_lost_money: c.lostMoney,
  };
  const ai = await askAI(
    "Scam alert",
    `You write community scam alerts for SeniorLink, read by older adults in Fredericton, New Brunswick, on their phones. From the linked reports, write:
- title: max 6 words, e.g. "Fake NB Power disconnection calls".
- summary: 1–2 plain sentences on what is happening and how many neighbours reported it. No names of reporters.
- howToSpot: 2–4 short bullet points (max 12 words each), including the exact phone numbers or websites if given.
- whatToDo: 2–3 short bullet points. Always include hanging up / not paying, calling the real organization using a trusted number, and reporting to the Canadian Anti-Fraud Centre at 1-888-495-8501.
Use only the facts provided. Calm, clear, never alarmist.`,
    JSON.stringify(facts),
    AlertSchema,
  );
  return ai ? { ...ai, source: "ai" } : null;
}
