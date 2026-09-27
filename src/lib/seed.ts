import { addDays, isoDate } from "./format";
import { minutesOf } from "./meds";
import { buildCampaigns, offlineAnalysis } from "./scams";
import type { ActivityEvent, AppState, Donation, DoseLog, ScamCampaign, ScamChannel, ScamReport, FamilyLink, HelpRequest, HourLog, Medication, OrgLink, Senior, TaskType, Volunteer } from "./types";

// All locations are real Fredericton / Oromocto neighbourhoods (approximate coordinates).

export const MARGARET: Senior = {
  id: "margaret",
  name: "Margaret Thompson",
  firstName: "Margaret",
  initials: "MT",
  color: "#E07A2F",
  address: "Waterloo Row, Fredericton",
  area: "Downtown Fredericton",
  lat: 45.9555,
  lng: -66.6385,
  verifiedOnly: true,
};

const EMILY: FamilyLink = {
  id: "emily",
  name: "Emily Thompson",
  initials: "ET",
  color: "#6D28D9",
  seniorId: "margaret",
  relation: "Daughter",
  callsThem: "Mom",
  status: "approved",
};

const VOLUNTEERS: Volunteer[] = [
  {
    id: "sarah",
    name: "Sarah Khan",
    initials: "SK",
    color: "#1B4530",
    org: "Fredericton Neighbours Network",
    area: "College Hill",
    lat: 45.948,
    lng: -66.66,
    skills: ["groceries", "pharmacy", "ride", "other"],
    availability: ["afternoon", "evening"],
    transport: "car",
    rating: 4.9,
    tasksCompleted: 42,
    seniorsHelped: 18,
    hours: 32,
    taskCounts: { pharmacy: 12, groceries: 21, ride: 7, other: 2 },
    verified: true,
    badge: "Community Helper",
  },
  {
    id: "priya",
    name: "Priya Sharma",
    initials: "PS",
    color: "#7C3AED",
    org: "UNB Student Volunteers",
    area: "Downtown",
    lat: 45.95,
    lng: -66.645,
    skills: ["groceries", "pharmacy", "other"],
    availability: ["afternoon", "evening"],
    transport: "walk",
    rating: 4.6,
    tasksCompleted: 3,
    seniorsHelped: 3,
    hours: 4,
    taskCounts: { groceries: 2, other: 1 },
    verified: false, // verification pending — filtered out by "verified only"
  },
  {
    id: "aisha",
    name: "Aisha Mohammed",
    initials: "AM",
    color: "#B45309",
    area: "Downtown",
    lat: 45.962,
    lng: -66.645,
    skills: ["groceries", "pharmacy", "other"],
    availability: ["morning"],
    transport: "car",
    rating: 4.8,
    tasksCompleted: 27,
    seniorsHelped: 11,
    hours: 22,
    taskCounts: { pharmacy: 9, groceries: 15, other: 3 },
    verified: true,
  },
  {
    id: "david",
    name: "David Chen",
    initials: "DC",
    color: "#1D4ED8",
    area: "Northside",
    lat: 45.972,
    lng: -66.63,
    skills: ["groceries", "ride"],
    availability: ["morning", "evening"],
    transport: "car",
    rating: 4.7,
    tasksCompleted: 19,
    seniorsHelped: 9,
    hours: 25,
    taskCounts: { ride: 11, groceries: 8 },
    verified: true,
  },
  {
    id: "tom",
    name: "Tom LeBlanc",
    initials: "TL",
    color: "#BE123C",
    area: "Skyline Acres",
    lat: 45.938,
    lng: -66.67,
    skills: ["snow", "ride", "other"],
    availability: ["morning", "afternoon"],
    transport: "truck",
    rating: 4.6,
    tasksCompleted: 31,
    seniorsHelped: 14,
    hours: 40,
    taskCounts: { snow: 24, ride: 5, other: 2 },
    verified: true,
  },
  {
    id: "marc",
    name: "Marc Arsenault",
    initials: "MA",
    color: "#047857",
    org: "Oromocto Lions Club",
    area: "Oromocto",
    lat: 45.849,
    lng: -66.479,
    skills: ["ride", "groceries"],
    availability: ["morning", "afternoon", "evening"],
    transport: "car",
    rating: 4.9,
    tasksCompleted: 56,
    seniorsHelped: 23,
    hours: 71,
    taskCounts: { ride: 44, groceries: 12 },
    verified: true,
  },
];

function otherRequests(now: number): HelpRequest[] {
  const base = { status: "open" as const, createdAt: now - 40 * 60_000 };
  return [
    {
      ...base,
      id: "req_dorothy",
      seniorId: "dorothy",
      seniorName: "Dorothy Allen",
      seniorArea: "Northside",
      lat: 45.97,
      lng: -66.625,
      taskType: "groceries",
      title: "Grocery pickup",
      details: "Small grocery order — milk, bread, eggs and fruit from Sobeys.",
      date: addDays(0),
      timeLabel: "4–6 PM",
      timeWindow: "afternoon",
      location: "Northside, Fredericton",
      destination: "Sobeys (Main St)",
      destLat: 45.9717,
      destLng: -66.6283,
      urgency: "low",
      shoppingList: [
        { id: "i1", name: "Milk (2%, 2 L)", qty: 1 },
        { id: "i2", name: "Whole wheat bread", qty: 1 },
        { id: "i3", name: "Large eggs (dozen)", qty: 1 },
        { id: "i4", name: "Bananas", qty: 6 },
        { id: "i5", name: "Chicken noodle soup", qty: 3 },
      ],
      substitutions: "similar",
      payment: "pay_back",
      budget: 40,
    },
    {
      ...base,
      id: "req_george",
      seniorId: "george",
      seniorName: "George MacLean",
      seniorArea: "Silverwood",
      lat: 45.945,
      lng: -66.69,
      taskType: "pharmacy",
      title: "Prescription pickup",
      details: "Prescription is ready at Shoppers Drug Mart on Prospect St.",
      date: addDays(0),
      timeLabel: "Evening",
      timeWindow: "evening",
      location: "Silverwood, Fredericton",
      destination: "Shoppers Drug Mart (Prospect St)",
      destLat: 45.9371,
      destLng: -66.6683,
      shoppingList: [
        { id: "i1", name: "Blood pressure prescription", qty: 1, kind: "prescription", rxNumber: "4471823" },
        { id: "i2", name: "Acetaminophen (Tylenol)", qty: 1, kind: "otc" },
      ],
      pharmacyAuthorized: true,
      payment: "paid_online",
      urgency: "high",
    },
    {
      ...base,
      id: "req_frank",
      seniorId: "frank",
      seniorName: "Frank Doucet",
      seniorArea: "Skyline Acres",
      lat: 45.937,
      lng: -66.665,
      taskType: "snow",
      title: "Snow shoveling",
      details: "Clear the front steps and walkway after the overnight snowfall.",
      date: addDays(1),
      timeLabel: "Morning",
      timeWindow: "morning",
      location: "Skyline Acres, Fredericton",
      urgency: "medium",
    },
    {
      ...base,
      id: "req_helen",
      seniorId: "helen",
      seniorName: "Helen Gallant",
      seniorArea: "Oromocto",
      lat: 45.848,
      lng: -66.48,
      taskType: "ride",
      title: "Ride to appointment",
      details: "Ride from Oromocto to the Dr. Everett Chalmers Hospital and back.",
      date: addDays(2),
      timeLabel: "10:00 AM",
      timeWindow: "morning",
      location: "Oromocto",
      destination: "Dr. Everett Chalmers Hospital",
      destLat: 45.9428,
      destLng: -66.6532,
      appointmentTime: "10:00",
      roundTrip: true,
      urgency: "medium",
      accessibility: "Uses a walker — needs help getting in and out of the car",
    },
    {
      ...base,
      id: "req_ruth",
      seniorId: "ruth",
      seniorName: "Ruth Coburn",
      seniorArea: "Downtown",
      lat: 45.96,
      lng: -66.64,
      taskType: "other",
      title: "Tablet video-call help",
      details: "Help setting up video calls on a new tablet to talk with grandchildren.",
      date: addDays(1),
      timeLabel: "Afternoon",
      timeWindow: "afternoon",
      location: "Downtown Fredericton",
      urgency: "low",
    },
  ];
}

const SENIOR_NAMES = [
  "Margaret", "Dorothy", "George", "Helen", "Ruth", "Frank", "Joan", "Bernard", "Lorraine", "Gerald", "Irene", "Walter",
  "Marguerite", "Roland", "Evelyn", "Clarence", "Yvonne", "Harold", "Doris", "Léo", "Shirley", "Arthur", "Gisèle", "Norman",
];

const LOG_TITLES: Record<TaskType, string[]> = {
  groceries: ["Grocery pickup", "Farmers market run", "Grocery delivery"],
  pharmacy: ["Prescription pickup", "Pharmacy pickup"],
  ride: ["Ride to appointment", "Ride to the clinic", "Ride to church", "Ride to the library"],
  snow: ["Snow shoveling", "Clearing steps and walkway"],
  other: ["Tablet help", "Friendly check-in", "Changing light bulbs"],
};

/** Deterministic pseudo-random numbers so the seed looks the same after every reset. */
function rng(seedText: string) {
  let s = 0;
  for (const c of seedText) s = (s * 31 + c.charCodeAt(0)) % 2147483647;
  s = s || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Builds a volunteer's past hours log that adds up exactly to their profile totals. */
function seedLogs(v: Volunteer, now: number): HourLog[] {
  const rand = rng(v.id);
  const types: TaskType[] = [];
  for (const [t, n] of Object.entries(v.taskCounts)) for (let i = 0; i < (n ?? 0); i++) types.push(t as TaskType);
  while (types.length < v.tasksCompleted) types.push(v.skills[0]);

  const hours = types.map(() => 0.5);
  for (let extra = (v.hours - 0.5 * types.length) / 0.5; extra > 0; extra--) {
    hours[Math.floor(rand() * hours.length)] += 0.5;
  }

  const names = SENIOR_NAMES.slice(0, Math.max(1, v.seniorsHelped));
  const day = 86_400_000;
  return types
    .map((taskType, i) => {
      const at = now - (2 + rand() * 170) * day;
      const titles = LOG_TITLES[taskType];
      return {
        id: `log_${v.id}_${i}`,
        volunteerId: v.id,
        taskType,
        title: titles[Math.floor(rand() * titles.length)],
        // Every senior in the profile count appears at least once.
        seniorFirstName: i < names.length ? names[i] : names[Math.floor(rand() * names.length)],
        at,
        hours: hours[i],
        confirmedAt: at + 3 * 3_600_000,
      };
    })
    .sort((a, b) => b.at - a.at);
}

/** Margaret's medicines. Vitamin D is scheduled for "right now" so the reminder fires during a demo. */
function seedMeds(now: number): { medications: Medication[]; doseLogs: DoseLog[] } {
  const d = new Date(now);
  const demoTime = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const base = { seniorId: "margaret", addedAt: now - 90 * 86_400_000 };
  const medications: Medication[] = [
    { ...base, id: "med_metformin", name: "Metformin", dose: "500 mg", purpose: "Blood sugar", instructions: "With food", times: ["08:00", "18:00"], pillsLeft: 46, look: { shape: "oval", color: "#F4F1EA" } },
    { ...base, id: "med_ramipril", name: "Ramipril", dose: "5 mg", purpose: "Blood pressure", times: ["08:00"], pillsLeft: 24, look: { shape: "capsule", color: "#D9546B", color2: "#F7E6E9" } },
    { ...base, id: "med_atorvastatin", name: "Atorvastatin", dose: "20 mg", purpose: "Cholesterol", times: ["21:00"], pillsLeft: 3, look: { shape: "round", color: "#FFFFFF" } },
    { ...base, id: "med_vitd", name: "Vitamin D", dose: "1000 IU", instructions: "With breakfast or lunch", times: [demoTime], pillsLeft: 80, look: { shape: "oval", color: "#F2C230" } },
  ];

  // Everything scheduled earlier today was taken on time, so the demo starts clean.
  const today = isoDate(d);
  const nowMin = d.getHours() * 60 + d.getMinutes();
  const doseLogs: DoseLog[] = medications.flatMap((m) =>
    m.times
      .filter((t) => minutesOf(t) < nowMin)
      .map((t) => ({
        id: `dose_${m.id}_${t}`,
        medId: m.id,
        seniorId: "margaret",
        date: today,
        time: t,
        status: "taken" as const,
        at: new Date(`${today}T${t}:00`).getTime() + 10 * 60_000,
      })),
  );
  return { medications, doseLogs };
}

// ---------- Scam Watch seed: modelled on scams reported in New Brunswick ----------

const SCAM_SEED: {
  hoursAgo: number;
  reporterId: string;
  role: ScamReport["reporterRole"];
  area: string;
  channel: ScamChannel;
  text: string;
  lostMoney?: boolean;
}[] = [
  { hoursAgo: 150, reporterId: "dorothy", role: "senior", area: "Northside", channel: "phone", text: "Got a call from 506-555-0142 saying they were NB Power and my power would be disconnected within one hour unless I paid the overdue bill at a bitcoin ATM." },
  { hoursAgo: 98, reporterId: "margaret", role: "senior", area: "Downtown Fredericton", channel: "phone", text: "Automated message said NB Power disconnection today, press 1. A man then told me to pay $480 at a bitcoin machine right away. The number was (506) 555-0199." },
  { hoursAgo: 50, reporterId: "helen", role: "senior", area: "Oromocto", channel: "phone", text: "Man claiming to be from NB Power called from 506 555 0142, threatened to shut off my electricity tonight and wanted payment in gift cards.", lostMoney: true },
  { hoursAgo: 5, reporterId: "david", role: "volunteer", area: "Nashwaaksis", channel: "phone", text: "A senior I help got an NB Power call about an unpaid bill and disconnection. They told her to go to a bitcoin ATM right away and stay on the phone." },
  { hoursAgo: 190, reporterId: "frank", role: "senior", area: "Skyline Acres", channel: "phone", text: "A young man called saying Grandma it's me, I was in a car accident and I'm in jail, please don't tell mom. Then a lawyer said I needed $6,000 for bail and a courier would pick up the cash." },
  { hoursAgo: 70, reporterId: "ruth", role: "senior", area: "College Hill", channel: "phone", text: "The caller sounded exactly like my grandson, crying, said he was arrested and needed bail money and not to tell his parents. Someone would come to the house to collect the money.", lostMoney: true },
  { hoursAgo: 22, reporterId: "sarah", role: "volunteer", area: "Marysville", channel: "phone", text: "One of my seniors got a call from her grandson saying he was in jail after an accident. He asked for bail money in cash and said a courier will come. The voice sounded just like him." },
  { hoursAgo: 118, reporterId: "george", role: "senior", area: "Downtown Fredericton", channel: "text", text: "Text: Canada Post, your parcel is on hold due to an incomplete address. Pay the $1.99 redelivery fee at canadapost-redeliver.com within 24 hours." },
  { hoursAgo: 46, reporterId: "priya", role: "volunteer", area: "Southwood Park", channel: "text", text: "Got a text saying my Canada Post package couldn't be delivered, with a link to cpost-track.info to pay a small fee." },
  { hoursAgo: 10, reporterId: "sarah", role: "volunteer", area: "Northside", channel: "text", text: "Canada Post text about a parcel waiting, pay redelivery fee at canadapost-redeliver.com" },
  { hoursAgo: 140, reporterId: "tom", role: "volunteer", area: "Lincoln", channel: "email", text: "Email from CRA saying I have a tax refund of $612.40 waiting. Click the link to cra-refund-portal.com and enter your SIN and banking info." },
  { hoursAgo: 26, reporterId: "aisha", role: "volunteer", area: "College Hill", channel: "email", text: "Got an email about a CRA tax refund asking me to verify my identity at cra-refund-portal.com" },
  { hoursAgo: 75, reporterId: "joan", role: "senior", area: "Downtown Fredericton", channel: "phone", text: "Someone from the RBC fraud department said my account was compromised and I should withdraw cash so they can trace the fraudster." },
  { hoursAgo: 210, reporterId: "walter", role: "senior", area: "Silverwood", channel: "online", text: "A pop-up on my computer said it was infected and to call Microsoft support at 1-844-555-0107. They wanted remote access." },
];

const CURATED_ALERTS: Record<string, ScamCampaign["alert"]> = {
  "Fake NB Power": {
    title: "Fake NB Power disconnection calls",
    summary: "Callers pretending to be NB Power say your power will be cut off within the hour unless you pay right away, usually at a bitcoin ATM or with gift cards.",
    howToSpot: ["Calls from (506) 555-0142 or (506) 555-0199", "Threat to disconnect power within hours", "Payment by bitcoin ATM or gift cards"],
    whatToDo: ["Hang up. NB Power never asks for bitcoin or gift cards.", "Call NB Power on the number on your bill.", "Report it to the Canadian Anti-Fraud Centre: 1-888-495-8501."],
    source: "curated",
  },
  "A grandchild": {
    title: "Grandchild-in-jail bail calls",
    summary: "A caller who sounds like a grandchild, sometimes an AI copy of their real voice, says they are in jail after an accident and need cash bail, and a courier comes to collect it.",
    howToSpot: ["\"Don't tell mom or dad\"", "Bail paid in cash or through a courier", "A \"lawyer\" or \"officer\" takes over the call"],
    whatToDo: ["Hang up and call your grandchild or their parents directly.", "In Canada, bail is never paid to a courier.", "Report it to police and the Canadian Anti-Fraud Centre: 1-888-495-8501."],
    source: "curated",
  },
  "Canada Post": {
    title: "Fake Canada Post redelivery texts",
    summary: "Texts claim a parcel is on hold and ask for a small redelivery fee through a link. The site steals card details.",
    howToSpot: ["Links to canadapost-redeliver.com or cpost-track.info", "A small fee, often $1.99", "A 24-hour deadline"],
    whatToDo: ["Don't tap the link. Delete the text.", "Track parcels only at canadapost.ca.", "If you entered card details, call your bank now."],
    source: "curated",
  },
};

function seedScams(now: number): { scamReports: ScamReport[]; campaigns: ScamCampaign[] } {
  const scamReports: ScamReport[] = SCAM_SEED.map((x, i) => ({
    id: `scam_${String(i + 1).padStart(2, "0")}`,
    reporterId: x.reporterId,
    reporterRole: x.role,
    area: x.area,
    channel: x.channel,
    text: x.text,
    analysis: offlineAnalysis(x.text),
    lostMoney: Boolean(x.lostMoney),
    sharedInfo: false,
    createdAt: now - x.hoursAgo * 3_600_000,
  }));
  const campaigns = buildCampaigns(scamReports, [], now).map((c) => {
    const curated =
      CURATED_ALERTS[c.impersonating === "NB Power" ? "Fake NB Power" : (c.impersonating ?? "")] ??
      (c.category === "delivery" ? CURATED_ALERTS["Canada Post"] : undefined);
    return curated ? { ...c, alert: curated, alertedAt: c.status === "alert" ? c.lastSeen : undefined } : c;
  });
  return { scamReports, campaigns };
}

function seedDonations(now: number): Donation[] {
  const day = 86_400_000;
  const rows: [string, number, boolean, string | null, number][] = [
    ["general", 2500, false, "Fredericton seniors' social club", 40],
    ["general", 1200, true, null, 30],
    ["general", 2300, false, "Anonymous neighbour", 12],
    ["gas", 1800, false, "Oromocto Community Church", 25],
    ["gas", 1300, true, "Linda M.", 9],
    ["snow", 950, false, "Mark T.", 20],
    ["snow", 1100, false, null, 4],
    ["safety", 700, false, "Joan R.", 15],
    ["safety", 450, true, null, 2],
  ];
  return rows.map(([fundId, amount, monthly, name, daysAgo], i) => ({
    id: `don_${i}`,
    fundId,
    amount,
    monthly,
    name,
    at: now - daysAgo * day,
  }));
}

export function createSeed(): AppState {
  const now = Date.now();
  const day = 86_400_000;

  const history: HelpRequest[] = [
    {
      id: "req_hist_ride",
      seniorId: "margaret",
      seniorName: MARGARET.name,
      seniorArea: MARGARET.area,
      lat: MARGARET.lat,
      lng: MARGARET.lng,
      taskType: "ride",
      title: "Ride to the library",
      details: "Ride to the Fredericton Public Library and back.",
      date: addDays(-3),
      timeLabel: "Morning",
      timeWindow: "morning",
      location: MARGARET.address,
      destination: "Fredericton Public Library",
      urgency: "low",
      status: "completed",
      createdAt: now - 3.4 * day,
      volunteerId: "david",
      acceptedAt: now - 3.3 * day,
      completedAt: now - 3 * day,
      rating: 5,
    },
    {
      id: "req_hist_groc",
      seniorId: "margaret",
      seniorName: MARGARET.name,
      seniorArea: MARGARET.area,
      lat: MARGARET.lat,
      lng: MARGARET.lng,
      taskType: "groceries",
      title: "Grocery pickup",
      details: "Weekly groceries from the Boyce Farmers Market.",
      date: addDays(-6),
      timeLabel: "Afternoon",
      timeWindow: "afternoon",
      location: MARGARET.address,
      destination: "Boyce Farmers Market",
      urgency: "low",
      status: "completed",
      createdAt: now - 6.3 * day,
      volunteerId: "sarah",
      acceptedAt: now - 6.2 * day,
      completedAt: now - 6 * day,
      rating: 5,
    },
  ];

  const activity: ActivityEvent[] = [
    { id: "evt_h1", seniorId: "margaret", requestId: "req_hist_ride", kind: "completed", message: "Ride to the library completed with David C.", at: now - 3 * day },
    { id: "evt_h2", seniorId: "margaret", requestId: "req_hist_ride", kind: "requested", message: "Requested a ride to the library", at: now - 3.4 * day },
    { id: "evt_h3", seniorId: "margaret", requestId: "req_hist_groc", kind: "completed", message: "Grocery pickup completed with Sarah K.", at: now - 6 * day },
    { id: "evt_h4", seniorId: "margaret", requestId: "req_hist_groc", kind: "requested", message: "Requested a grocery pickup", at: now - 6.3 * day },
  ];

  return {
    version: 1,
    seniors: [structuredClone(MARGARET)],
    volunteers: structuredClone(VOLUNTEERS),
    family: [structuredClone(EMILY)],
    hourLogs: VOLUNTEERS.flatMap((v) => seedLogs(v, now)),
    ...seedMeds(now),
    ...seedScams(now),
    donations: seedDonations(now),
    orgLinks: [
      { id: "orglink_priya_unb", volunteerId: "priya", orgId: "unb", memberRef: "psharma@unb.ca", connectedAt: now - 20 * day } satisfies OrgLink,
    ],
    submissions: [],
    requests: [...otherRequests(now), ...history],
    activity,
  };
}
