import { NextResponse } from "next/server";
import { actOnRequest, type Action } from "@/lib/store";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { action: Action; volunteerId?: string; rating?: number };
  const result = actOnRequest(id, body.action, body);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
