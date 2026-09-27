import { NextResponse } from "next/server";
import { addMember, type NewMember } from "@/lib/store";

export async function POST(req: Request) {
  const result = addMember((await req.json()) as NewMember);
  return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
}
