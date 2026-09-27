export type TaskType = "groceries" | "pharmacy" | "ride" | "snow" | "other";
export type TimeWindow = "morning" | "afternoon" | "evening" | "anytime";
export type Urgency = "low" | "medium" | "high";
export type RequestStatus =
  | "open"
  | "matched"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface ShoppingItem {
  id: string;
  name: string;
  qty: number;
  status?: "got" | "unavailable"; // set by the volunteer while shopping
  kind?: "prescription" | "otc"; // pharmacy items only
  rxNumber?: string; // prescription number, helps the pharmacy find it
}

/** A request as understood by the AI (or filled in by hand), before it is saved. */
export interface Draft {
  taskType: TaskType;
  title: string;
  details: string;
  date: string; // YYYY-MM-DD
  timeLabel: string; // "Afternoon", "10:00 AM", "4–6 PM"
  timeWindow: TimeWindow;
  location: string;
  destination?: string | null;
  urgency: Urgency;
  accessibility?: string | null;
  // Rides
  appointmentTime?: string | null; // "10:30" (24h)
  roundTrip?: boolean;
  // Groceries
  shoppingList?: ShoppingItem[];
  substitutions?: "similar" | "skip" | "call";
  payment?: "pay_back" | "paid_online";
  budget?: number | null;
  // Pharmacy
  pharmacyAuthorized?: boolean; // senior has told the pharmacy a volunteer will pick up
}

export interface HelpRequest extends Draft {
  id: string;
  seniorId: string;
  seniorName: string;
  seniorArea: string;
  lat: number; // pickup / meeting point
  lng: number;
  destLat?: number;
  destLng?: number;
  status: RequestStatus;
  createdAt: number;
  rideStage?: "to_pickup" | "picked_up";
  pickedUpAt?: number;
  receiptTotal?: number;
  matchedVolunteerId?: string;
  matchReasons?: string[];
  matchExplanation?: string;
  matchKm?: number;
  volunteerId?: string;
  acceptedAt?: number;
  startedAt?: number;
  completedAt?: number;
  rating?: number;
}

export interface Volunteer {
  id: string;
  name: string;
  initials: string;
  color: string;
  photo?: string;
  org?: string;
  area: string;
  lat: number;
  lng: number;
  skills: TaskType[];
  availability: TimeWindow[];
  transport: "car" | "truck" | "walk" | "bus";
  rating: number;
  tasksCompleted: number;
  seniorsHelped: number;
  hours: number;
  taskCounts: Partial<Record<TaskType, number>>;
  verified: boolean;
  badge?: string;
}

export interface Senior {
  id: string;
  name: string;
  firstName: string;
  initials: string;
  color: string;
  photo?: string; // URL from /api/photos
  address: string;
  area: string;
  lat: number;
  lng: number;
  verifiedOnly: boolean;
}

/** A family member's access to one senior's activity. The senior approves and can revoke it. */
export interface FamilyLink {
  id: string;
  name: string;
  initials: string;
  color: string;
  photo?: string;
  seniorId: string;
  relation: string; // "Daughter", "Son", "Grandson"...
  callsThem: string; // what they call the senior: "Mom", "Grandma"
  status: "pending" | "approved" | "revoked";
}

/** A medicine a senior takes, with the clock times it's due each day. */
export interface Medication {
  id: string;
  seniorId: string;
  name: string;
  dose: string; // "500 mg", "1 tablet"
  purpose?: string; // "Blood sugar" — optional, in the senior's words
  instructions?: string; // "With food"
  times: string[]; // "08:00", "20:00" (24h, local)
  pillsLeft?: number;
  photo?: string; // photo of the pill or bottle
  look?: PillLook; // drawn picture when there's no photo
  addedAt: number;
}

export interface PillLook {
  shape: "round" | "oval" | "capsule";
  color: string;
  color2?: string; // second half of a capsule
}

export interface DoseLog {
  id: string;
  medId: string;
  seniorId: string;
  date: string; // YYYY-MM-DD
  time: string; // scheduled "08:00"
  status: "taken" | "skipped";
  at: number;
}

export interface HealthSuggestion {
  name: string; // e.g. "Acetaminophen (Tylenol)"
  why: string;
  caution: string;
}

export interface HealthReply {
  reply: string;
  level: "emergency" | "urgent" | "see_doctor" | "self_care" | "info";
  suggestions: HealthSuggestion[];
  interactionWarning: string | null;
  source: "ai" | "offline";
}

// ---------- Scam Watch ----------

export type ScamChannel = "phone" | "text" | "email" | "online" | "door" | "social" | "mail";

export type ScamCategory =
  | "grandparent"
  | "utility"
  | "government"
  | "bank"
  | "delivery"
  | "tech_support"
  | "romance"
  | "investment"
  | "prize"
  | "phishing"
  | "other";

export interface ScamIndicators {
  phones: string[]; // normalised "+15065550142"
  domains: string[]; // "canadapost-redeliver.com"
  emails: string[];
  payments: string[]; // "gift cards", "bitcoin ATM"...
}

export interface ScamAnalysis {
  verdict: "likely_scam" | "suspicious" | "probably_safe";
  category: ScamCategory;
  impersonating: string | null; // "NB Power", "CRA", "a grandchild"
  tactics: string[]; // "urgency", "secrecy", "threats"...
  title: string; // short, e.g. "Fake NB Power disconnection call"
  summary: string; // one sentence with the reporter's personal details removed
  advice: string;
  indicators: ScamIndicators;
  source: "ai" | "offline";
}

export interface ScamReport {
  id: string;
  reporterId: string;
  reporterRole: "senior" | "volunteer" | "family";
  area: string;
  channel: ScamChannel;
  text: string;
  analysis: ScamAnalysis;
  lostMoney: boolean;
  sharedInfo: boolean;
  createdAt: number;
}

export interface ScamLink {
  a: string; // report ids
  b: string;
  reason: string; // "same phone number (506) 555-0142"
  kind: "indicator" | "entity" | "text";
}

export interface ScamCampaign {
  id: string; // id of the earliest report in the cluster (stable)
  reportIds: string[];
  links: ScamLink[];
  category: ScamCategory;
  impersonating: string | null;
  indicators: ScamIndicators;
  areas: string[];
  channels: ScamChannel[];
  firstSeen: number;
  lastSeen: number;
  recent72h: number;
  lostMoney: number;
  status: "watching" | "alert";
  alert: { title: string; summary: string; howToSpot: string[]; whatToDo: string[]; source: "ai" | "offline" | "curated" };
  alertedAt?: number;
}

// ---------- Donations ----------

export interface Donation {
  id: string;
  fundId: string;
  amount: number;
  monthly: boolean;
  name: string | null; // null = anonymous
  at: number;
}

/** One entry in a volunteer's hours log — created when a task is completed. */
export interface HourLog {
  id: string;
  volunteerId: string;
  requestId?: string;
  taskType: TaskType;
  title: string;
  seniorFirstName: string; // first name only, for privacy
  at: number;
  hours: number;
  confirmedAt?: number; // senior confirmed (rated) the help
}

/** A volunteer's link to an organization that recognises volunteer hours (e.g. UNB). */
export interface OrgLink {
  id: string;
  volunteerId: string;
  orgId: string;
  memberRef: string; // school email / student number
  connectedAt: number;
}

export interface CreditSubmission {
  id: string;
  volunteerId: string;
  orgId: string;
  logIds: string[];
  hours: number;
  submittedAt: number;
  status: "submitted" | "approved";
  approvedAt?: number;
  reference?: string;
}

export interface ActivityEvent {
  id: string;
  seniorId: string;
  requestId?: string;
  kind: "requested" | "matched" | "accepted" | "in_progress" | "completed" | "cancelled" | "privacy";
  message: string;
  at: number;
}

export interface AppState {
  version: number;
  seniors: Senior[];
  volunteers: Volunteer[];
  family: FamilyLink[];
  hourLogs: HourLog[];
  medications: Medication[];
  doseLogs: DoseLog[];
  scamReports: ScamReport[];
  campaigns: ScamCampaign[];
  donations: Donation[];
  orgLinks: OrgLink[];
  submissions: CreditSubmission[];
  requests: HelpRequest[];
  activity: ActivityEvent[];
  aiEnabled?: boolean;
  aiProvider?: "snowflake" | "claude" | "offline";
}

export interface ParseResult {
  emergency: boolean;
  tasks: Draft[];
  combine: { suggest: boolean; message: string };
  reply: string;
  source: "ai" | "offline";
}
