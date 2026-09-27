import type {
  ScamAnalysis,
  ScamCampaign,
  ScamCategory,
  ScamChannel,
  ScamIndicators,
  ScamLink,
  ScamReport,
} from "./types";

// Scam Watch engine.
//
// Reports are linked into campaigns the way fraud analysts do it:
//   1. Shared indicators — the same scammer phone number, website domain or email → strong link.
//   2. Same scam type AND same impersonated organization (e.g. both "NB Power") → link,
//      because scammers rotate numbers and domains but keep the story.
//   3. Similar wording (token overlap) within the same scam type → link.
// Links are only made between reports within 30 days of each other. Each connected
// component of this graph is a campaign. A campaign becomes a public alert once it has
// 3+ reports, or 2+ where someone lost money.

export const CATEGORY_LABEL: Record<ScamCategory, string> = {
  grandparent: "Family emergency scam",
  utility: "Utility impersonation",
  government: "Government impersonation",
  bank: "Bank investigator scam",
  delivery: "Delivery text scam",
  tech_support: "Tech support scam",
  romance: "Romance scam",
  investment: "Investment scam",
  prize: "Prize or lottery scam",
  phishing: "Phishing",
  other: "Other scam",
};

export const CHANNEL_LABEL: Record<ScamChannel, string> = {
  phone: "Phone call",
  text: "Text message",
  email: "Email",
  online: "Website or pop-up",
  door: "At my door",
  social: "Social media",
  mail: "Mail",
};

const LINK_WINDOW_MS = 30 * 86_400_000;

// ---------- Indicator extraction ----------

export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return ten.length === 10 ? `+1${ten}` : null;
}

export function formatPhone(e164: string): string {
  const d = e164.replace(/^\+1/, "");
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** "https://secure.canadapost-redeliver.com/pay" → "canadapost-redeliver.com" */
function registrableDomain(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
  return parts.slice(-2).join(".");
}

const LEGIT_DOMAINS = new Set(["canada.ca", "canadapost.ca", "nbpower.com", "gnb.ca", "google.com", "microsoft.com"]);

const PAYMENTS: [RegExp, string][] = [
  [/gift ?cards?|itunes|google play card|steam card/i, "gift cards"],
  [/bitcoin atm|crypto atm|bitcoin machine/i, "bitcoin ATM"],
  [/bitcoin|crypto/i, "cryptocurrency"],
  [/e-?transfer|interac/i, "e-Transfer"],
  [/wire transfer|western union|moneygram/i, "wire transfer"],
  [/courier|pick up (the )?(cash|money)|send someone to collect/i, "cash courier"],
];

export function extractIndicators(text: string): ScamIndicators {
  const phones = new Set<string>();
  for (const m of text.matchAll(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g)) {
    const p = normalisePhone(m[0]);
    if (p) phones.add(p);
  }
  const emails = new Set<string>();
  for (const m of text.matchAll(/[\w.+-]+@([\w-]+\.)+[a-z]{2,}/gi)) emails.add(m[0].toLowerCase());

  const domains = new Set<string>();
  const withoutEmails = text.replace(/[\w.+-]+@([\w-]+\.)+[a-z]{2,}/gi, " ");
  for (const m of withoutEmails.matchAll(/\b(?:https?:\/\/)?((?:[a-z0-9-]+\.)+(?:com|ca|net|org|info|xyz|top|online|site|co|io|app|link|live|shop))\b/gi)) {
    const d = registrableDomain(m[1]);
    if (!LEGIT_DOMAINS.has(d)) domains.add(d);
  }

  const payments = new Set<string>();
  for (const [re, label] of PAYMENTS) if (re.test(text)) payments.add(label);
  if (payments.has("bitcoin ATM")) payments.delete("cryptocurrency");

  return { phones: [...phones], domains: [...domains], emails: [...emails], payments: [...payments] };
}

/** "NB Power" is a named organization; "A grandchild" / "A bank" are generic roles. */
function namedEntity(e: string | null): boolean {
  return Boolean(e) && !/^an? /i.test(e!);
}

// ---------- Offline classification (used when AI is unavailable) ----------

const CATEGORY_RULES: [ScamCategory, RegExp][] = [
  ["grandparent", /grand(son|daughter|child|ma|pa|mother|father)|it'?s me|in jail|bail|don'?t tell (mom|dad|anyone)|nephew|niece/i],
  ["utility", /nb power|hydro|power (bill|will be)|disconnect|shut off your (power|electricity)/i],
  ["government", /\bcra\b|canada revenue|tax (refund|owing)|\bsin\b|social insurance|service canada|arrest warrant|immigration/i],
  ["bank", /fraud department|bank investigator|your (bank )?account (is|has been) compromised|withdraw (cash|money)|security team from (rbc|td|bmo|scotia|cibc)/i],
  ["delivery", /canada post|package|parcel|redeliver|purolator|fedex|\bups\b|shipment/i],
  ["tech_support", /microsoft|apple support|virus|pop-?up|remote access|anydesk|teamviewer|computer is (infected|locked)/i],
  ["romance", /dating|fell in love|met (him|her) online|sweetheart|widower|oil rig/i],
  ["investment", /investment|returns|trading platform|double your money|crypto (profit|platform)/i],
  ["prize", /you (have )?won|winner|lottery|prize|sweepstakes/i],
  ["phishing", /verify your (account|identity)|click (the|this) link|password|login/i],
];

const ENTITIES: [RegExp, string][] = [
  [/nb power/i, "NB Power"],
  [/canada revenue|\bcra\b/i, "CRA"],
  [/service canada|\bsin\b|social insurance/i, "Service Canada"],
  [/canada post/i, "Canada Post"],
  [/microsoft/i, "Microsoft"],
  [/apple/i, "Apple"],
  [/amazon/i, "Amazon"],
  [/\brcmp\b|police/i, "Police"],
  [/scotia|\brbc\b|\btd\b|\bbmo\b|cibc|desjardins|bank/i, "A bank"],
  [/grand(son|daughter|child)|nephew|niece|it'?s me/i, "A grandchild"],
];

const TACTICS: [RegExp, string][] = [
  [/now|immediately|right away|within (an|one|1) hour|today|urgent|last chance/i, "urgency"],
  [/don'?t tell|keep (this|it) (quiet|secret)|between us/i, "secrecy"],
  [/arrest|jail|police|disconnect|shut off|suspend|lawsuit|fine/i, "threats"],
  [/won|prize|refund|reward/i, "promise of money"],
  [/remote access|anydesk|teamviewer|install/i, "remote access"],
  [/gift ?card|bitcoin|crypto|wire|courier/i, "unusual payment"],
];

export function offlineAnalysis(text: string): ScamAnalysis {
  const indicators = extractIndicators(text);
  const category = CATEGORY_RULES.find(([, re]) => re.test(text))?.[0] ?? "other";
  const impersonating = ENTITIES.find(([re]) => re.test(text))?.[1] ?? null;
  const tactics = TACTICS.filter(([re]) => re.test(text)).map(([, t]) => t);
  const redFlags = tactics.length + indicators.payments.length + (category !== "other" ? 1 : 0);
  const verdict = redFlags >= 2 ? "likely_scam" : redFlags === 1 ? "suspicious" : "probably_safe";
  return {
    verdict,
    category,
    impersonating,
    tactics,
    title: namedEntity(impersonating) ? `Fake ${impersonating} ${CATEGORY_LABEL[category].toLowerCase()}` : CATEGORY_LABEL[category],
    summary: text.length > 180 ? `${text.slice(0, 177)}…` : text,
    advice:
      verdict === "probably_safe"
        ? "Nothing here looks like a known scam, but never share passwords or pay anyone you didn't contact first."
        : "Don't reply, click links or pay. Hang up and call the organization back using a number you already trust.",
    indicators,
    source: "offline",
  };
}

// ---------- Text similarity ----------

const STOP = new Set(
  "a an the and or but if to of in on at for from by with is are was were be been it its this that i me my we you your he she they them our us he his her as so not no do did have has had will would can could just said says call called about into up out then than there their what when who how".split(
    " ",
  ),
);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/https?:\/\/\S+|[\w.+-]+@\S+|\d+/g, " ")
      .split(/[^a-zà-ÿ]+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map((w) => w.replace(/(ing|ed|es|s)$/, "")),
  );
}

export function textSimilarity(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter); // Jaccard
}

// ---------- Linking & clustering ----------

export function linkReports(a: ScamReport, b: ScamReport): ScamLink | null {
  if (Math.abs(a.createdAt - b.createdAt) > LINK_WINDOW_MS) return null;
  const ia = a.analysis.indicators;
  const ib = b.analysis.indicators;

  const phone = ia.phones.find((p) => ib.phones.includes(p));
  if (phone) return { a: a.id, b: b.id, reason: `same phone number ${formatPhone(phone)}`, kind: "indicator" };
  const domain = ia.domains.find((d) => ib.domains.includes(d));
  if (domain) return { a: a.id, b: b.id, reason: `same website ${domain}`, kind: "indicator" };
  const email = ia.emails.find((e) => ib.emails.includes(e));
  if (email) return { a: a.id, b: b.id, reason: `same email ${email}`, kind: "indicator" };

  const sameCategory = a.analysis.category === b.analysis.category && a.analysis.category !== "other";
  const ea = a.analysis.impersonating?.toLowerCase();
  if (sameCategory && ea && ea === b.analysis.impersonating?.toLowerCase()) {
    const who = a.analysis.impersonating!;
    const reason = namedEntity(who) ? `both impersonate ${who}` : `both claim to be ${who.toLowerCase()}`;
    return { a: a.id, b: b.id, reason, kind: "entity" };
  }
  const sim = textSimilarity(a.text, b.text);
  if ((sameCategory && sim >= 0.18) || sim >= 0.4) {
    return { a: a.id, b: b.id, reason: `similar wording (${Math.round(sim * 100)}% overlap)`, kind: "text" };
  }
  return null;
}

function merge(list: ScamIndicators[]): ScamIndicators {
  const u = (k: keyof ScamIndicators) => [...new Set(list.flatMap((i) => i[k]))];
  return { phones: u("phones"), domains: u("domains"), emails: u("emails"), payments: u("payments") };
}

function mostCommon<T>(items: T[]): T {
  const counts = new Map<T, number>();
  for (const x of items) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Template alert used until (or instead of) the AI-written one. */
export function templateAlert(c: Pick<ScamCampaign, "category" | "impersonating" | "indicators" | "reportIds" | "areas">) {
  const spot = [
    ...c.indicators.phones.slice(0, 3).map((p) => `Calls or texts from ${formatPhone(p)}`),
    ...c.indicators.domains.slice(0, 3).map((d) => `Links to ${d}`),
    ...c.indicators.payments.slice(0, 2).map((p) => `Asks you to pay with ${p}`),
  ];
  return {
    title: namedEntity(c.impersonating) ? `Fake ${c.impersonating} scam` : CATEGORY_LABEL[c.category],
    summary: `${c.reportIds.length} people in ${c.areas.slice(0, 3).join(", ")} have reported this ${CATEGORY_LABEL[c.category].toLowerCase()}.`,
    howToSpot: spot.length ? spot : ["Pressure to act right now", "A request to keep it secret"],
    whatToDo: [
      "Hang up or don't reply. Never pay or share personal details.",
      "Call the organization back using a number you already trust.",
      "Report it to the Canadian Anti-Fraud Centre: 1-888-495-8501.",
    ],
    source: "offline" as const,
  };
}

/**
 * Rebuilds campaigns from all reports (union–find over the link graph).
 * `previous` carries AI-written alert text and alert times forward for campaigns that still exist.
 */
export function buildCampaigns(reports: ScamReport[], previous: ScamCampaign[], now = Date.now()): ScamCampaign[] {
  const sorted = [...reports].sort((a, b) => a.createdAt - b.createdAt);
  const order = new Map(sorted.map((r, i) => [r.id, i]));
  const parent = new Map(sorted.map((r) => [r.id, r.id]));
  const find = (x: string): string => {
    while (parent.get(x) !== x) x = parent.get(x)!;
    return x;
  };
  const links: ScamLink[] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const l = linkReports(sorted[i], sorted[j]);
      if (!l) continue;
      links.push(l);
      const ra = find(l.a);
      const rb = find(l.b);
      if (ra === rb) continue;
      // Keep the earliest report as the root so campaign ids stay stable.
      const [older, newer] = order.get(ra)! < order.get(rb)! ? [ra, rb] : [rb, ra];
      parent.set(newer, older);
    }
  }

  const groups = new Map<string, ScamReport[]>();
  for (const r of sorted) {
    const root = find(r.id);
    groups.set(root, [...(groups.get(root) ?? []), r]);
  }

  const campaigns: ScamCampaign[] = [];
  for (const [id, rs] of groups) {
    if (rs.length < 2) continue;
    const ids = new Set(rs.map((r) => r.id));
    const indicators = merge(rs.map((r) => r.analysis.indicators));
    const entities = rs.map((r) => r.analysis.impersonating).filter((e): e is string => Boolean(e));
    const lostMoney = rs.filter((r) => r.lostMoney).length;
    const base = {
      id,
      reportIds: rs.map((r) => r.id),
      links: links.filter((l) => ids.has(l.a) && ids.has(l.b)),
      category: mostCommon(rs.map((r) => r.analysis.category)),
      impersonating: entities.length ? mostCommon(entities) : null,
      indicators,
      areas: [...new Set(rs.map((r) => r.area))],
      channels: [...new Set(rs.map((r) => r.channel))],
      firstSeen: rs[0].createdAt,
      lastSeen: rs[rs.length - 1].createdAt,
      recent72h: rs.filter((r) => now - r.createdAt < 72 * 3_600_000).length,
      lostMoney,
    };
    const status: ScamCampaign["status"] = rs.length >= 3 || (rs.length >= 2 && lostMoney > 0) ? "alert" : "watching";
    const prev = previous.find((p) => p.id === id);
    campaigns.push({
      ...base,
      status,
      alert: prev && prev.alert.source !== "offline" ? prev.alert : templateAlert(base),
      alertedAt: status === "alert" ? (prev?.alertedAt ?? now) : undefined,
    });
  }
  return campaigns.sort((a, b) => (a.status === b.status ? b.lastSeen - a.lastSeen : a.status === "alert" ? -1 : 1));
}

/** Reports per day for the last `days` days (oldest first). */
export function dailyCounts(reports: ScamReport[], days = 7, now = Date.now()): { label: string; count: number }[] {
  const out: { label: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const start = new Date(now - i * 86_400_000);
    start.setHours(0, 0, 0, 0);
    const end = start.getTime() + 86_400_000;
    out.push({
      label: start.toLocaleDateString("en-CA", { weekday: "short" }),
      count: reports.filter((r) => r.createdAt >= start.getTime() && r.createdAt < end).length,
    });
  }
  return out;
}
