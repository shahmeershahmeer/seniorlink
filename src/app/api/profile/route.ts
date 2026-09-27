import { NextResponse } from "next/server";
import { setProfilePhoto } from "@/lib/store";

export async function POST(req: Request) {
  const { kind, id, photo } = await req.json();
  if (!["senior", "volunteer", "family"].includes(kind)) return NextResponse.json({ error: "Bad kind" }, { status: 400 });
  const result = setProfilePhoto(kind, String(id), photo ?? null);
  return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
}
