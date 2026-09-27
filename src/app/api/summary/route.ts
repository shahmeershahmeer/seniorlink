import { NextResponse } from "next/server";
import { familySummary } from "@/lib/ai";
import { getSenior, getState, volunteerShortName } from "@/lib/store";

export async function POST(req: Request) {
  const { familyId } = await req.json().catch(() => ({}));
  const state = getState();
  const link = state.family.find((f) => f.id === familyId);
  if (!link || link.status !== "approved") return NextResponse.json({ error: "Not shared" }, { status: 403 });
  const senior = getSenior(link.seniorId)!;
  const requests = state.requests.filter((r) => r.seniorId === senior.id);
  const activity = state.activity.filter((a) => a.seniorId === senior.id);
  return NextResponse.json(await familySummary(senior, link, requests, activity, volunteerShortName));
}
