import { NextResponse } from "next/server";
import { verifyVolunteer } from "@/lib/store";

export async function POST(req: Request) {
  const { volunteerId } = await req.json();
  // Simulated ID check: a short pause so it feels like a real verification step.
  await new Promise((r) => setTimeout(r, 1500));
  const v = verifyVolunteer(volunteerId);
  if (!v) return NextResponse.json({ error: "Unknown volunteer" }, { status: 404 });
  return NextResponse.json(v);
}
