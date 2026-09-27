import { NextResponse } from "next/server";
import { updateSenior } from "@/lib/store";

export async function POST(req: Request) {
  const { seniorId, verifiedOnly } = await req.json();
  const senior = updateSenior(seniorId, typeof verifiedOnly === "boolean" ? { verifiedOnly } : {});
  if (!senior) return NextResponse.json({ error: "Unknown senior" }, { status: 404 });
  return NextResponse.json(senior);
}
