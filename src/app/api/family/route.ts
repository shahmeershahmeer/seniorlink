import { NextResponse } from "next/server";
import { setFamilyStatus } from "@/lib/store";

export async function POST(req: Request) {
  const { linkId, status } = await req.json();
  if (!["approved", "revoked", "pending"].includes(status)) {
    return NextResponse.json({ error: "Bad status" }, { status: 400 });
  }
  const link = setFamilyStatus(linkId, status);
  if (!link) return NextResponse.json({ error: "Unknown family member" }, { status: 404 });
  return NextResponse.json(link);
}
