import { TASKS, addDays, dateLabel } from "./format";
import type { Draft, ParseResult, Senior, TaskType, TimeWindow } from "./types";

// Keyword fallback used when there is no OpenAI key or the network is down.
// Handles the demo sentences in English and French.

const EMERGENCY =
  /(chest pain|can'?t breathe|cannot breathe|trouble breathing|heart attack|stroke|i fell|i'?ve fallen|fallen and|can'?t get up|bleeding badly|unconscious|overdose|suicid|call 911|douleur (à|a) la poitrine|je ne peux pas respirer|je suis tomb|crise cardiaque)/i;

export function looksLikeEmergency(text: string): boolean {
  return EMERGENCY.test(text);
}

const KEYWORDS: [TaskType, RegExp, string][] = [
  ["pharmacy", /(prescription|pharmac|medication|medicine|pills|m[ée]dicament|ordonnance)/i, "Prescription pickup"],
  ["groceries", /(grocer|food|milk|bread|supermarket|sobeys|walmart|atlantic superstore|[ée]picerie|courses)/i, "Grocery pickup"],
  ["ride", /(\bride\b|\bdrive\b|\blift\b|appointment|doctor|hospital|clinic|take me|rendez-vous|conduire|m[ée]decin|h[ôo]pital)/i, "Ride"],
  ["snow", /(snow|shovel|driveway|\bice\b|neige|pelleter|d[ée]neiger)/i, "Snow shoveling"],
];

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const PLACES = ["Oromocto", "Fredericton", "Saint John", "Moncton", "Halifax", "Nashwaaksis", "Northside", "Downtown"];

function parseDate(t: string): string {
  if (/(tomorrow|demain)/i.test(t)) return addDays(1);
  if (/(today|tonight|this (afternoon|morning|evening)|aujourd'hui|ce soir)/i.test(t)) return addDays(0);
  const today = new Date().getDay();
  for (let i = 0; i < 7; i++) {
    if (t.toLowerCase().includes(WEEKDAYS[i])) return addDays(((i - today + 7) % 7) || 7);
  }
  return addDays(0);
}

function parseTime(t: string): { timeLabel: string; timeWindow: TimeWindow } {
  const at = t.match(/\bat (\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i) ?? t.match(/\b(\d{1,2})\s*h\s*(\d{2})?/i);
  if (at) {
    let h = parseInt(at[1], 10);
    const min = at[2] ?? "00";
    const suffix = at[3]?.toLowerCase().replace(/\./g, "");
    if (suffix === "pm" && h < 12) h += 12;
    if (!suffix && h >= 1 && h <= 6) h += 12; // "at 3" almost always means 3 PM
    const window: TimeWindow = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
    const h12 = ((h + 11) % 12) + 1;
    return { timeLabel: `${h12}:${min} ${h < 12 ? "AM" : "PM"}`, timeWindow: window };
  }
  if (/(morning|matin)/i.test(t)) return { timeLabel: "Morning", timeWindow: "morning" };
  if (/(afternoon|apr[èe]s-midi)/i.test(t)) return { timeLabel: "Afternoon", timeWindow: "afternoon" };
  if (/(evening|tonight|soir)/i.test(t)) return { timeLabel: "Evening", timeWindow: "evening" };
  return { timeLabel: "Any time", timeWindow: "anytime" };
}

const GROCERY_WORDS = [
  "milk", "bread", "eggs", "butter", "cheese", "yogurt", "bananas", "apples", "oranges", "potatoes", "carrots",
  "onions", "lettuce", "tomatoes", "chicken", "ground beef", "fish", "soup", "cereal", "oatmeal", "coffee", "tea",
  "sugar", "flour", "rice", "pasta", "juice", "crackers", "cookies", "toilet paper", "tissues", "dish soap",
  "lait", "pain", "oeufs", "œufs", "beurre", "fromage", "pommes", "café", "thé",
];

/** Pulls known grocery items (with simple quantities like "2 litres of milk" or "a dozen eggs") out of speech. */
function groceryItems(text: string) {
  const t = text.toLowerCase();
  return GROCERY_WORDS.filter((w) => new RegExp(`\\b${w}\\b`).test(t)).map((w, i) => {
    const qtyMatch = t.match(new RegExp(`(\\d+|a dozen|two|three|four|six)\\s+(?:\\w+\\s+){0,2}${w}`));
    const words: Record<string, number> = { "a dozen": 12, two: 2, three: 3, four: 4, six: 6 };
    const raw = qtyMatch?.[1];
    const qty = raw ? (words[raw] ?? parseInt(raw, 10)) : 1;
    const name = w[0].toUpperCase() + w.slice(1);
    return { id: `item${i}`, name: raw === "a dozen" ? `${name} (dozen)` : name, qty: raw === "a dozen" ? 1 : Math.min(qty, 20) };
  });
}

const OTC_WORDS: [RegExp, string][] = [
  [/tylenol|acetaminophen/i, "Acetaminophen (Tylenol)"],
  [/antacid|tums|heartburn/i, "Antacid (Tums)"],
  [/cough (syrup|drops)|sirop/i, "Cough syrup"],
  [/saline|nasal spray/i, "Saline nasal spray"],
  [/vitamin d/i, "Vitamin D"],
  [/band-?aids?|bandages?|pansements?/i, "Bandages"],
  [/lozenges?|throat drops/i, "Throat lozenges"],
];

function pharmacyItems(text: string) {
  const items: { id: string; name: string; qty: number; kind: "prescription" | "otc" }[] = [];
  if (/(prescription|refill|ordonnance|m[ée]dicaments?|my (pills|medication|medicine))/i.test(text)) {
    items.push({ id: "item0", name: "My prescription", qty: 1, kind: "prescription" });
  }
  for (const [re, name] of OTC_WORDS) if (re.test(text)) items.push({ id: `item${items.length}`, name, qty: 1, kind: "otc" });
  return items;
}

export function offlineParse(text: string, senior: Senior): ParseResult {
  if (looksLikeEmergency(text)) {
    return { emergency: true, tasks: [], combine: { suggest: false, message: "" }, reply: "", source: "offline" };
  }

  const date = parseDate(text);
  const time = parseTime(text);
  const urgency = /(urgent|asap|right away|as soon as|tout de suite|vite)/i.test(text) ? "high" : "medium";

  let found = KEYWORDS.filter(([, re]) => re.test(text));
  if (found.length === 0) found = [["other", /./, "Help request"]];

  const tasks: Draft[] = found.map(([taskType, , title]) => {
    let location = senior.address;
    let destination: string | null = null;
    if (taskType === "ride") {
      const from = PLACES.find((p) => new RegExp(`from ${p}`, "i").test(text));
      const to = PLACES.find((p) => new RegExp(`to ${p}`, "i").test(text));
      if (from) location = from;
      destination = to ?? (/(doctor|m[ée]decin|appointment|rendez-vous)/i.test(text) ? "Doctor's appointment" : null);
    }
    if (taskType === "pharmacy") destination = "Nearest pharmacy";
    const ride = taskType === "ride";
    return {
      taskType,
      title,
      details: text.trim(),
      date,
      ...time,
      location,
      destination,
      urgency,
      accessibility: /(walker|wheelchair|cane|d[ée]ambulateur|fauteuil)/i.test(text) ? "Mobility aid mentioned" : null,
      appointmentTime: ride && /\d/.test(time.timeLabel) ? to24h(time.timeLabel) : null,
      roundTrip: ride && /(and back|back home|bring me home|round trip|return|retour)/i.test(text),
      shoppingList: taskType === "groceries" ? groceryItems(text) : taskType === "pharmacy" ? pharmacyItems(text) : undefined,
    };
  });

  const names = tasks.map((t) => t.title.toLowerCase()).join(" and ");
  const when = `${dateLabel(date).toLowerCase()}${time.timeWindow === "anytime" ? "" : ` (${time.timeLabel.toLowerCase()})`}`;
  const combine =
    tasks.length > 1
      ? { suggest: true, message: `The ${names} can be done in one trip. Would you like one combined request?` }
      : { suggest: false, message: "" };

  return {
    emergency: false,
    tasks,
    combine,
    reply: `I'll ask a trusted neighbour to help with ${tasks.length > 1 ? names : `a ${TASKS[tasks[0].taskType].noun} task`} ${when}. Is that right?`,
    source: "offline",
  };
}

function to24h(label: string): string | null {
  const m = label.match(/(\d{1,2}):(\d{2}) (AM|PM)/);
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (m[3] === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}
