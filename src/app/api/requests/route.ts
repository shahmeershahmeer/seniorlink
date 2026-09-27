import { NextResponse } from "next/server";
import { createRequests } from "@/lib/store";
import type { Draft } from "@/lib/types";

export async function POST(req: Request) {
  const { drafts, seniorId = "margaret" } = (await req.json()) as { drafts: Draft[]; seniorId?: string };
  if (!Array.isArray(drafts) || drafts.length === 0) {
    return NextResponse.json({ error: "No requests" }, { status: 400 });
  }
  const created = await createRequests(seniorId, drafts);
  return NextResponse.json({ requests: created });
}
