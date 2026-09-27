import { NextResponse } from "next/server";
import { removeMember } from "@/lib/store";

export async function POST(req: Request) {
  const { kind, id } = await req.json();
  if (!["senior", "volunteer", "family"].includes(kind)) return NextResponse.json({ error: "Bad kind" }, { status: 400 });
  const result = removeMember(kind, String(id));
  return NextResponse.json(result, { status: "error" in result ? 404 : 200 });
}
