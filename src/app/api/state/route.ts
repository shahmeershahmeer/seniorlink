import { NextResponse } from "next/server";
import { aiEnabled, aiProvider } from "@/lib/ai";
import { getState, tickSubmissions } from "@/lib/store";

export const dynamic = "force-dynamic";

export function GET() {
  tickSubmissions();
  return NextResponse.json({ ...getState(), aiEnabled: aiEnabled(), aiProvider: aiProvider() });
}
