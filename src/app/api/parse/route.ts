import { NextResponse } from "next/server";
import { parseRequest } from "@/lib/ai";
import { getSenior } from "@/lib/store";

export async function POST(req: Request) {
  const { text, seniorId = "margaret" } = await req.json();
  const senior = getSenior(seniorId);
  if (!senior || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  return NextResponse.json(await parseRequest(text.slice(0, 1000), senior));
}
