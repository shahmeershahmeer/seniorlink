import { analyzeScam, explainMatch, writeScamAlert } from "./ai";
import { fundById } from "./funds";
import { buildCampaigns } from "./scams";
import { addDays, familyTitle, firstName, isoDate, shortName } from "./format";
import { cannotHelp, rankVolunteers } from "./matching";
import { NEIGHBOURHOODS, colorFor, initialsOf, resolvePlace } from "./places";
import { clockIn, driveMinutes, rideStatus } from "./eta";
import { createSeed } from "./seed";
import { isConfirmed } from "./hours";
import { orgById } from "./orgs";
import type { ActivityEvent, AppState, CreditSubmission, DoseLog, Draft, ShoppingItem, FamilyLink, Medication, PillLook, ScamAnalysis, ScamChannel, ScamReport, HelpRequest, Senior, TaskType, TimeWindow, Volunteer } from "./types";

// In-memory store (lives as long as the server process). Perfect for a hackathon demo:
// every phone polls /api/state, and "Reset demo" restores the seed.

const g = globalThis as unknown as { __seniorlink?: AppState };

export function getState(): AppState {
  if (!g.__seniorlink) g.__seniorlink = createSeed();
  return g.__seniorlink;
}

export function resetState(): AppState {
  g.__seniorlink = createSeed();
  return g.__seniorlink;
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function log(state: AppState, e: Omit<ActivityEvent, "id" | "at">) {
  state.activity.unshift({ ...e, id: uid("evt"), at: Date.now() });
  state.version++;
}

export function getSenior(id: string): Senior | undefined {
  return getState().seniors.find((s) => s.id === id);
}

export function volunteerShortName(id?: string): string {
  const v = getState().volunteers.find((x) => x.id === id);
  return v ? shortName(v.name) : "a volunteer";
}

export async function createRequests(seniorId: string, drafts: Draft[]): Promise<HelpRequest[]> {
  const state = getState();
  const senior = getSenior(seniorId);
  if (!senior) throw new Error("Unknown senior");

  const created: HelpRequest[] = [];
  for (const d of drafts) {
    // Pickup is the senior's home unless they gave another place we recognise.
    const atHome = !d.location || d.location.trim() === senior.address;
    const pickup = atHome ? null : resolvePlace(d.location);
    const dest = resolvePlace(d.destination);
    const req: HelpRequest = {
      ...d,
      // "the hospital" → "Dr. Everett Chalmers Hospital", so volunteers know exactly where to go.
      destination: dest?.known ? dest.name : d.destination,
      shoppingList: cleanList(d.shoppingList),
      budget: typeof d.budget === "number" && d.budget > 0 ? Math.round(d.budget) : null,
      id: uid("req"),
      seniorId,
      seniorName: senior.name,
      seniorArea: senior.area,
      lat: pickup?.lat ?? senior.lat,
      lng: pickup?.lng ?? senior.lng,
      destLat: dest?.lat,
      destLng: dest?.lng,
      status: "open",
      createdAt: Date.now(),
    };
    log(state, { seniorId, requestId: req.id, kind: "requested", message: `Requested: ${familyTitle(req)}` });

    const [best] = rankVolunteers(req, state.volunteers, { verifiedOnly: senior.verifiedOnly });
    if (best) {
      req.status = "matched";
      req.matchedVolunteerId = best.volunteer.id;
      req.matchReasons = best.reasons;
      req.matchKm = Number(best.km.toFixed(1));
      req.matchExplanation = await explainMatch(req, best);
      log(state, {
        seniorId,
        requestId: req.id,
        kind: "matched",
        message: `Matched with ${shortName(best.volunteer.name)} (${req.matchKm} km away)`,
      });
    }
    state.requests.unshift(req);
    created.push(req);
  }
  return created;
}

export type Action = "accept" | "start" | "pickup" | "complete" | "cancel" | "rate" | "item";

function cleanList(list: unknown): ShoppingItem[] | undefined {
  if (!Array.isArray(list)) return undefined;
  const seen = new Set<string>();
  const items = list
    .map((x) => ({
      id: typeof x?.id === "string" && x.id ? x.id.slice(0, 24) : uid("item"),
      name: String(x?.name ?? "").trim().slice(0, 60),
      qty: Math.max(1, Math.min(99, Math.round(Number(x?.qty) || 1))),
      ...(x?.kind === "prescription" || x?.kind === "otc" ? { kind: x.kind as "prescription" | "otc" } : {}),
      ...(typeof x?.rxNumber === "string" && x.rxNumber.trim() ? { rxNumber: x.rxNumber.trim().slice(0, 20) } : {}),
    }))
    .filter((x) => x.name)
    .map((x) => {
      // Ids must be unique within a request (combined lists can repeat "item0").
      const id = seen.has(x.id) ? uid("item") : x.id;
      seen.add(id);
      return { ...x, id };
    });
  return items.length ? items.slice(0, 60) : undefined;
}

export function actOnRequest(
  id: string,
  action: Action,
  opts: { volunteerId?: string; rating?: number; hours?: number; itemId?: string; itemStatus?: ShoppingItem["status"] | null; receiptTotal?: number },
): { ok: true; request: HelpRequest } | { ok: false; error: string } {
  const state = getState();
  const req = state.requests.find((r) => r.id === id);
  if (!req) return { ok: false, error: "Request not found" };
  const vol = state.volunteers.find((v) => v.id === (opts.volunteerId ?? req.volunteerId));
  const who = vol ? firstName(vol.name) : "A volunteer";
  // Only the assigned volunteer can move their task forward.
  const volunteerOnly: Action[] = ["start", "pickup", "complete", "item"];
  if (volunteerOnly.includes(action) && opts.volunteerId && req.volunteerId && opts.volunteerId !== req.volunteerId) {
    return { ok: false, error: "This task belongs to another volunteer" };
  }
  const task = familyTitle(req).toLowerCase(); // activity is visible to family

  switch (action) {
    case "accept": {
      if (!vol) return { ok: false, error: "Volunteer required" };
      if (req.status !== "open" && req.status !== "matched") return { ok: false, error: "Already taken" };
      // Seniors we have no settings for (e.g. demo data) default to verified-only, the safe choice.
      const reason = cannotHelp(req, vol, getSenior(req.seniorId)?.verifiedOnly ?? true);
      if (reason) return { ok: false, error: reason };
      req.status = "accepted";
      req.volunteerId = vol.id;
      req.acceptedAt = Date.now();
      log(state, { seniorId: req.seniorId, requestId: id, kind: "accepted", message: `${shortName(vol.name)} accepted the ${task}` });
      break;
    }
    case "start":
      if (req.status !== "accepted") return { ok: false, error: "Not accepted yet" };
      req.status = "in_progress";
      req.startedAt = Date.now();
      if (req.taskType === "ride") {
        req.rideStage = "to_pickup";
        const eta = rideStatus(req, vol).toPickupMin;
        log(state, {
          seniorId: req.seniorId,
          requestId: id,
          kind: "in_progress",
          message: `${who} is driving to pick up ${firstName(req.seniorName)}${eta ? `, about ${eta} min away` : ""}`,
        });
      } else {
        log(state, { seniorId: req.seniorId, requestId: id, kind: "in_progress", message: `${who} is on the way — ${task} in progress` });
      }
      break;
    case "pickup": {
      if (req.taskType !== "ride" || req.status !== "in_progress") return { ok: false, error: "Not a ride in progress" };
      req.rideStage = "picked_up";
      req.pickedUpAt = Date.now();
      const trip = req.destLat != null && req.destLng != null ? driveMinutes(req, { lat: req.destLat, lng: req.destLng }) : null;
      log(state, {
        seniorId: req.seniorId,
        requestId: id,
        kind: "in_progress",
        message: `${firstName(req.seniorName)} was picked up${req.destination ? ` and is heading to ${req.destination}` : ""}${trip ? `, arriving around ${clockIn(trip)}` : ""}`,
      });
      break;
    }
    case "item": {
      const item = req.shoppingList?.find((x) => x.id === opts.itemId);
      if (!item || req.status !== "in_progress") return { ok: false, error: "Can't update that item" };
      item.status = opts.itemStatus ?? undefined;
      state.version++;
      break;
    }
    case "complete":
      if (req.status !== "accepted" && req.status !== "in_progress") return { ok: false, error: "Not in progress" };
      req.status = "completed";
      req.completedAt = Date.now();
      if (typeof opts.receiptTotal === "number" && opts.receiptTotal > 0) req.receiptTotal = Math.round(opts.receiptTotal * 100) / 100;
      if (vol) {
        const hours = Math.max(0.5, Math.min(12, Math.round((opts.hours ?? 1) * 2) / 2));
        const helpedBefore = state.requests.some(
          (r) => r.id !== id && r.volunteerId === vol.id && r.seniorId === req.seniorId && r.status === "completed",
        );
        vol.tasksCompleted++;
        vol.hours += hours;
        if (!helpedBefore) vol.seniorsHelped++;
        vol.taskCounts[req.taskType] = (vol.taskCounts[req.taskType] ?? 0) + 1;
        state.hourLogs.unshift({
          id: uid("log"),
          volunteerId: vol.id,
          requestId: id,
          taskType: req.taskType,
          title: req.title,
          seniorFirstName: firstName(req.seniorName),
          at: Date.now(),
          hours,
        });
      }
      log(state, {
        seniorId: req.seniorId,
        requestId: id,
        kind: "completed",
        message: `${familyTitle(req)} completed${vol ? ` with ${shortName(vol.name)}` : ""}`,
      });
      break;
    case "cancel":
      if (req.status === "completed") return { ok: false, error: "Already completed" };
      req.status = "cancelled";
      log(state, { seniorId: req.seniorId, requestId: id, kind: "cancelled", message: `Cancelled: ${familyTitle(req)}` });
      break;
    case "rate":
      if (req.status !== "completed" || !opts.rating) return { ok: false, error: "Cannot rate" };
      req.rating = Math.max(1, Math.min(5, Math.round(opts.rating)));
      // The senior's rating confirms the volunteer's logged hours.
      for (const l of state.hourLogs) if (l.requestId === id && !l.confirmedAt) l.confirmedAt = Date.now();
      state.version++;
      break;
  }
  return { ok: true, request: req };
}

export function updateSenior(id: string, patch: Partial<Pick<Senior, "verifiedOnly">>) {
  const state = getState();
  const s = getSenior(id);
  if (!s) return null;
  Object.assign(s, patch);
  state.version++;
  return s;
}

// ---------- Members joining ----------

export type NewMember =
  | { role: "senior"; name: string; area: string; street?: string }
  | {
      role: "volunteer";
      name: string;
      area: string;
      org?: string;
      skills: TaskType[];
      availability: TimeWindow[];
      transport: Volunteer["transport"];
    }
  | { role: "family"; name: string; seniorId: string; relation: string; callsThem: string };

/** Small random offset so members in the same neighbourhood don't stack on the map. */
function placeIn(area: string) {
  const n = NEIGHBOURHOODS.find((x) => x.name === area) ?? NEIGHBOURHOODS[0];
  const jitter = () => (Math.random() - 0.5) * 0.012;
  return { area: n.name, lat: n.lat + jitter(), lng: n.lng + jitter() };
}

export function addMember(m: NewMember): { role: NewMember["role"]; id: string } | { error: string } {
  const state = getState();
  const name = m.name.trim().replace(/\s+/g, " ");
  if (name.length < 2) return { error: "Please enter a name" };
  const base = { name, initials: initialsOf(name), color: colorFor(name) };

  if (m.role === "senior") {
    const place = placeIn(m.area);
    const senior: Senior = {
      ...base,
      ...place,
      id: uid("sen"),
      firstName: firstName(name),
      address: m.street?.trim() ? `${m.street.trim()}, ${place.area}` : place.area,
      verifiedOnly: true,
    };
    state.seniors.push(senior);
    state.version++;
    return { role: "senior", id: senior.id };
  }

  if (m.role === "volunteer") {
    if (!m.skills.length) return { error: "Pick at least one way you can help" };
    const vol: Volunteer = {
      ...base,
      ...placeIn(m.area),
      id: uid("vol"),
      org: m.org?.trim() || undefined,
      skills: m.skills,
      availability: m.availability.length ? m.availability : ["morning", "afternoon", "evening"],
      transport: m.transport,
      rating: 5,
      tasksCompleted: 0,
      seniorsHelped: 0,
      hours: 0,
      taskCounts: {},
      verified: false, // must complete the (simulated) ID check first
      badge: "New Neighbour",
    };
    state.volunteers.push(vol);
    state.version++;
    return { role: "volunteer", id: vol.id };
  }

  const senior = getSenior(m.seniorId);
  if (!senior) return { error: "Choose who you're connecting with" };
  const link: FamilyLink = {
    ...base,
    id: uid("fam"),
    seniorId: senior.id,
    relation: m.relation.trim() || "Family",
    callsThem: m.callsThem.trim() || senior.firstName,
    status: "pending",
  };
  state.family.push(link);
  state.version++;
  return { role: "family", id: link.id };
}

/** Simulated identity check — a real product would use a verification provider. */
export function verifyVolunteer(id: string) {
  const state = getState();
  const v = state.volunteers.find((x) => x.id === id);
  if (!v) return null;
  v.verified = true;
  state.version++;
  return v;
}

export function setFamilyStatus(linkId: string, status: FamilyLink["status"]) {
  const state = getState();
  const link = state.family.find((f) => f.id === linkId);
  if (!link) return null;
  if (link.status !== status) {
    const verb = { approved: "Shared activity with", revoked: "Stopped sharing activity with", pending: "Access requested by" }[status];
    log(state, { seniorId: link.seniorId, kind: "privacy", message: `${verb} ${link.name}` });
  }
  link.status = status;
  state.version++;
  return link;
}

// ---------- Volunteer hours & credit ----------

export function connectOrg(volunteerId: string, orgId: string, memberRef: string) {
  const state = getState();
  if (!state.volunteers.some((v) => v.id === volunteerId)) return { error: "Unknown volunteer" };
  if (!orgById(orgId)) return { error: "Unknown organization" };
  if (memberRef.trim().length < 3) return { error: "Please enter your email or student number" };
  if (state.orgLinks.some((l) => l.volunteerId === volunteerId && l.orgId === orgId)) return { error: "Already connected" };
  const link = { id: uid("orglink"), volunteerId, orgId, memberRef: memberRef.trim(), connectedAt: Date.now() };
  state.orgLinks.push(link);
  state.version++;
  return { link };
}

export function disconnectOrg(volunteerId: string, orgId: string) {
  const state = getState();
  state.orgLinks = state.orgLinks.filter((l) => !(l.volunteerId === volunteerId && l.orgId === orgId));
  state.version++;
  return { ok: true };
}

/** Sends every confirmed hour not yet shared with this organization. */
export function submitHours(volunteerId: string, orgId: string) {
  const state = getState();
  if (!state.orgLinks.some((l) => l.volunteerId === volunteerId && l.orgId === orgId)) return { error: "Connect first" };
  const already = new Set(
    state.submissions.filter((s) => s.volunteerId === volunteerId && s.orgId === orgId).flatMap((s) => s.logIds),
  );
  const logs = state.hourLogs.filter((l) => l.volunteerId === volunteerId && isConfirmed(l) && !already.has(l.id));
  if (!logs.length) return { error: "No new confirmed hours to submit" };
  const submission: CreditSubmission = {
    id: uid("sub"),
    volunteerId,
    orgId,
    logIds: logs.map((l) => l.id),
    hours: logs.reduce((t, l) => t + l.hours, 0),
    submittedAt: Date.now(),
    status: "submitted",
  };
  state.submissions.unshift(submission);
  state.version++;
  return { submission };
}

/** Simulates the organization reviewing a submission a few seconds later. */
export function tickSubmissions() {
  const state = getState();
  for (const s of state.submissions) {
    if (s.status === "submitted" && Date.now() - s.submittedAt > 6_000) {
      s.status = "approved";
      s.approvedAt = Date.now();
      s.reference = `${orgById(s.orgId)?.short ?? "ORG"}-${Math.floor(100000 + Math.random() * 900000)}`;
      state.version++;
    }
  }
}

// ---------- Medications ----------

export function addMedication(
  seniorId: string,
  m: Pick<Medication, "name" | "dose" | "purpose" | "instructions" | "times" | "pillsLeft" | "photo" | "look">,
) {
  const state = getState();
  if (!getSenior(seniorId)) return { error: "Unknown senior" };
  if (!m.name?.trim()) return { error: "Please enter the medicine name" };
  const times = [...new Set((m.times ?? []).filter((t) => /^\d{2}:\d{2}$/.test(t)))].sort();
  if (!times.length) return { error: "Choose at least one time" };
  const med: Medication = {
    id: uid("med"),
    seniorId,
    name: m.name.trim(),
    dose: m.dose?.trim() || "",
    purpose: m.purpose?.trim() || undefined,
    instructions: m.instructions?.trim() || undefined,
    times,
    pillsLeft: typeof m.pillsLeft === "number" && m.pillsLeft >= 0 ? Math.round(m.pillsLeft) : undefined,
    photo: isPhotoUrl(m.photo) ? m.photo : undefined,
    look: validLook(m.look),
    addedAt: Date.now(),
  };
  state.medications.push(med);
  state.version++;
  return { med };
}

export function removeMedication(medId: string) {
  const state = getState();
  state.medications = state.medications.filter((m) => m.id !== medId);
  state.version++;
  return { ok: true };
}

export function logDose(medId: string, time: string, status: DoseLog["status"]) {
  const state = getState();
  const med = state.medications.find((m) => m.id === medId);
  if (!med) return { error: "Unknown medicine" };
  const date = isoDate(new Date());
  const existing = state.doseLogs.find((l) => l.medId === medId && l.date === date && l.time === time);
  if (existing) {
    if (existing.status === "taken" && med.pillsLeft != null) med.pillsLeft++; // undo previous count
    state.doseLogs = state.doseLogs.filter((l) => l !== existing);
  }
  state.doseLogs.push({ id: uid("dose"), medId, seniorId: med.seniorId, date, time, status, at: Date.now() });
  if (status === "taken" && med.pillsLeft != null && med.pillsLeft > 0) med.pillsLeft--;
  state.version++;
  return { ok: true };
}

/** Running low → one tap creates a pharmacy pickup request for a volunteer. */
export async function requestRefill(medId: string) {
  const state = getState();
  const med = state.medications.find((m) => m.id === medId);
  const senior = med && getSenior(med.seniorId);
  if (!med || !senior) return { error: "Unknown medicine" };
  const [req] = await createRequests(senior.id, [
    {
      taskType: "pharmacy",
      title: "Prescription refill pickup",
      // The medicine name stays private; the pharmacy has the prescription on file.
      details: "A prescription refill is ready at the pharmacy. Please pick it up and bring it home.",
      date: addDays(1),
      timeLabel: "Afternoon",
      timeWindow: "afternoon",
      location: senior.address,
      destination: "Senior's usual pharmacy",
      urgency: "medium",
      accessibility: null,
      shoppingList: [{ id: "refill", name: "Prescription refill (ask for it under the senior's name)", qty: 1, kind: "prescription" }],
      payment: "pay_back",
      pharmacyAuthorized: false,
    },
  ]);
  return { request: req };
}

// ---------- Photos (people and medicines) ----------

const photoStore = globalThis as unknown as { __seniorlinkPhotos?: Map<string, { type: string; data: Buffer }> };
const photos = (photoStore.__seniorlinkPhotos ??= new Map());
const MAX_PHOTO_BYTES = 600_000;

export function savePhoto(dataUrl: string) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? "");
  if (!m) return { error: "Please choose a JPEG, PNG or WebP image" };
  const data = Buffer.from(m[2], "base64");
  if (data.length > MAX_PHOTO_BYTES) return { error: "That photo is too large" };
  const id = uid("photo");
  photos.set(id, { type: m[1], data });
  return { url: `/api/photos/${id}` };
}

export function getPhoto(id: string) {
  return photos.get(id);
}

function isPhotoUrl(url: unknown): url is string {
  return typeof url === "string" && /^\/api\/photos\/photo_[a-z0-9]+$/.test(url);
}

function validLook(look: unknown): PillLook | undefined {
  const l = look as PillLook | undefined;
  if (!l || !["round", "oval", "capsule"].includes(l.shape) || !/^#[0-9a-f]{6}$/i.test(l.color)) return undefined;
  return { shape: l.shape, color: l.color, color2: l.color2 && /^#[0-9a-f]{6}$/i.test(l.color2) ? l.color2 : undefined };
}

export function setProfilePhoto(kind: "senior" | "volunteer" | "family", id: string, photo: string | null) {
  const state = getState();
  if (photo !== null && !isPhotoUrl(photo)) return { error: "Bad photo" };
  const list = kind === "senior" ? state.seniors : kind === "volunteer" ? state.volunteers : state.family;
  const person = (list as { id: string; photo?: string }[]).find((p) => p.id === id);
  if (!person) return { error: "Not found" };
  person.photo = photo ?? undefined;
  state.version++;
  return { ok: true };
}

export function setMedicationPicture(medId: string, photo: string | null, look?: PillLook) {
  const state = getState();
  const med = state.medications.find((m) => m.id === medId);
  if (!med) return { error: "Unknown medicine" };
  if (photo !== null && !isPhotoUrl(photo)) return { error: "Bad photo" };
  med.photo = photo ?? undefined;
  if (look) med.look = validLook(look) ?? med.look;
  state.version++;
  return { ok: true };
}

// ---------- Scam Watch ----------

const analyses = globalThis as unknown as { __seniorlinkAnalyses?: Map<string, { text: string; channel: ScamChannel; analysis: ScamAnalysis }> };
const pendingAnalyses = (analyses.__seniorlinkAnalyses ??= new Map());

/** Checks a suspicious message: AI + pattern analysis, and which active campaign it would join. */
export async function checkScam(text: string, channel: ScamChannel, area: string) {
  const clean = text.trim().slice(0, 2000);
  if (clean.length < 8) return { error: "Please describe what happened" };
  const analysis = await analyzeScam(clean, channel);
  const analysisId = uid("chk");
  pendingAnalyses.set(analysisId, { text: clean, channel, analysis });

  // Dry run: would this report link into an existing campaign?
  const state = getState();
  const probe: ScamReport = {
    id: "probe",
    reporterId: "probe",
    reporterRole: "senior",
    area,
    channel,
    text: clean,
    analysis,
    lostMoney: false,
    sharedInfo: false,
    createdAt: Date.now(),
  };
  const trial = buildCampaigns([...state.scamReports, probe], state.campaigns);
  const joined = trial.find((c) => c.reportIds.includes("probe"));
  const existing = joined && state.campaigns.find((c) => c.reportIds.some((id) => joined.reportIds.includes(id)));
  const reasons = joined ? [...new Set(joined.links.filter((l) => l.a === "probe" || l.b === "probe").map((l) => l.reason))] : [];
  return { analysisId, analysis, match: existing ? { campaignId: existing.id, title: existing.alert.title, reports: existing.reportIds.length, reasons } : null };
}

export async function submitScamReport(input: {
  analysisId: string;
  reporterId: string;
  reporterRole: ScamReport["reporterRole"];
  area: string;
  lostMoney: boolean;
  sharedInfo: boolean;
}) {
  const state = getState();
  const pending = pendingAnalyses.get(input.analysisId);
  if (!pending) return { error: "Please check the message again" };
  pendingAnalyses.delete(input.analysisId);
  const report: ScamReport = {
    id: uid("scam"),
    reporterId: input.reporterId,
    reporterRole: input.reporterRole,
    area: input.area,
    channel: pending.channel,
    text: pending.text,
    analysis: pending.analysis,
    lostMoney: input.lostMoney,
    sharedInfo: input.sharedInfo,
    createdAt: Date.now(),
  };
  state.scamReports.push(report);
  await refreshCampaigns();
  const campaign = state.campaigns.find((c) => c.reportIds.includes(report.id)) ?? null;
  return { report, campaign };
}

/** "I got this too": a one-tap report that copies an alert's pattern. */
export async function reportSameScam(campaignId: string, reporterId: string, reporterRole: ScamReport["reporterRole"], area: string) {
  const state = getState();
  const c = state.campaigns.find((x) => x.id === campaignId);
  const template = c && state.scamReports.find((r) => r.id === c.reportIds[c.reportIds.length - 1]);
  if (!c || !template) return { error: "Unknown alert" };
  const already = state.scamReports.some((r) => c.reportIds.includes(r.id) && r.reporterId === reporterId);
  if (already) return { ok: true, already: true };
  state.scamReports.push({
    ...template,
    id: uid("scam"),
    reporterId,
    reporterRole,
    area,
    lostMoney: false,
    sharedInfo: false,
    createdAt: Date.now(),
  });
  await refreshCampaigns();
  return { ok: true };
}

/** Re-clusters every report, then has Claude write alerts for campaigns that just became alerts. */
async function refreshCampaigns() {
  const state = getState();
  const before = new Map(state.campaigns.map((c) => [c.id, c.status]));
  state.campaigns = buildCampaigns(state.scamReports, state.campaigns);
  state.version++;

  for (const c of state.campaigns) {
    const newlyAlerted = c.status === "alert" && before.get(c.id) !== "alert";
    if (!newlyAlerted || c.alert.source !== "offline") continue;
    const alert = await writeScamAlert(c, state.scamReports.filter((r) => c.reportIds.includes(r.id)));
    if (alert) {
      c.alert = alert;
      state.version++;
    }
  }
}

// ---------- Donations ----------

export function donate(fundId: string, amount: number, monthly: boolean, name: string | null) {
  const state = getState();
  if (!fundById(fundId)) return { error: "Choose a fund" };
  const dollars = Math.round(Number(amount));
  if (!Number.isFinite(dollars) || dollars < 1 || dollars > 10_000) return { error: "Choose an amount between $1 and $10,000" };
  const donation = { id: uid("don"), fundId, amount: dollars, monthly: Boolean(monthly), name: name?.trim() || null, at: Date.now() };
  state.donations.push(donation);
  state.version++;
  return { donation };
}

// ---------- Removing a profile ----------

/**
 * Deletes a member and everything that only makes sense with them.
 * Community data (scam reports) is kept but anonymised; a volunteer's unfinished
 * requests go back to "waiting" so no senior is left without help.
 */
export function removeMember(kind: "senior" | "volunteer" | "family", id: string) {
  const state = getState();
  const dropPhoto = (url?: string) => {
    const m = url && /\/api\/photos\/(photo_[a-z0-9]+)$/.exec(url);
    if (m) photos.delete(m[1]);
  };

  if (kind === "senior") {
    const senior = getSenior(id);
    if (!senior) return { error: "Not found" };
    dropPhoto(senior.photo);
    const requestIds = new Set(state.requests.filter((r) => r.seniorId === id).map((r) => r.id));
    state.seniors = state.seniors.filter((s) => s.id !== id);
    state.requests = state.requests.filter((r) => r.seniorId !== id);
    state.family = state.family.filter((f) => f.seniorId !== id);
    state.medications = state.medications.filter((m) => m.seniorId !== id);
    state.doseLogs = state.doseLogs.filter((d) => d.seniorId !== id);
    state.activity = state.activity.filter((a) => a.seniorId !== id);
    // Volunteers keep their hours (first names only), but no longer linked to the deleted requests.
    for (const l of state.hourLogs) if (l.requestId && requestIds.has(l.requestId)) l.requestId = undefined;
    for (const r of state.scamReports) if (r.reporterId === id) r.reporterId = "removed";
  } else if (kind === "volunteer") {
    const vol = state.volunteers.find((v) => v.id === id);
    if (!vol) return { error: "Not found" };
    dropPhoto(vol.photo);
    for (const r of state.requests) {
      const active = r.status === "accepted" || r.status === "in_progress" || r.status === "matched";
      if (active && (r.volunteerId === id || r.matchedVolunteerId === id)) {
        r.status = "open";
        r.volunteerId = undefined;
        r.matchedVolunteerId = undefined;
        r.matchExplanation = undefined;
        r.matchReasons = undefined;
        r.rideStage = undefined;
        r.startedAt = undefined;
        r.acceptedAt = undefined;
        for (const item of r.shoppingList ?? []) item.status = undefined;
        log(state, { seniorId: r.seniorId, requestId: r.id, kind: "cancelled", message: `${r.title}: looking for a new volunteer` });
      }
    }
    state.volunteers = state.volunteers.filter((v) => v.id !== id);
    state.hourLogs = state.hourLogs.filter((l) => l.volunteerId !== id);
    state.orgLinks = state.orgLinks.filter((l) => l.volunteerId !== id);
    state.submissions = state.submissions.filter((s) => s.volunteerId !== id);
    for (const r of state.scamReports) if (r.reporterId === id) r.reporterId = "removed";
  } else {
    const link = state.family.find((f) => f.id === id);
    if (!link) return { error: "Not found" };
    dropPhoto(link.photo);
    state.family = state.family.filter((f) => f.id !== id);
  }
  state.version++;
  return { ok: true };
}
