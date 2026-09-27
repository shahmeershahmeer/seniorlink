import { NextResponse } from "next/server";
import { savePhoto } from "@/lib/store";

export async function POST(req: Request) {
  const { dataUrl } = await req.json();
  const result = savePhoto(String(dataUrl ?? ""));
  return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
}
