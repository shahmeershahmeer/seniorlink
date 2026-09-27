import { NextResponse } from "next/server";
import { healthChat } from "@/lib/ai";
import { getSenior, getState } from "@/lib/store";

export async function POST(req: Request) {
  const { seniorId, messages } = (await req.json()) as {
    seniorId: string;
    messages: { role: "user" | "assistant"; content: string }[];
  };
  const senior = getSenior(seniorId);
  if (!senior || !Array.isArray(messages) || messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const clean = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  const meds = getState().medications.filter((m) => m.seniorId === senior.id);
  return NextResponse.json(await healthChat(senior, meds, clean));
}
