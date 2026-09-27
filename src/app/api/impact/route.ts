import { NextResponse } from "next/server";
import { impactStatement } from "@/lib/ai";
import { isConfirmed } from "@/lib/hours";
import { orgById } from "@/lib/orgs";
import { getState } from "@/lib/store";

export async function POST(req: Request) {
  const { volunteerId, orgId } = await req.json();
  const state = getState();
  const v = state.volunteers.find((x) => x.id === volunteerId);
  if (!v) return NextResponse.json({ error: "Unknown volunteer" }, { status: 404 });
  const logs = state.hourLogs.filter((l) => l.volunteerId === v.id && isConfirmed(l));
  const org = orgId ? orgById(orgId) : undefined;
  return NextResponse.json(await impactStatement(v, logs, org ? `${org.name} ${org.program}` : undefined));
}
