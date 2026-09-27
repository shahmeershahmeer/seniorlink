import { NextResponse } from "next/server";
import { aiModelName, aiProvider } from "@/lib/ai";
import { aiCalls } from "@/lib/aiLog";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ provider: aiProvider(), model: aiModelName(), calls: aiCalls() });
}
