import { NextResponse } from "next/server";
import { connectOrg, disconnectOrg, submitHours } from "@/lib/store";

export async function POST(req: Request) {
  const { action, volunteerId, orgId, memberRef = "" } = await req.json();
  const result =
    action === "connect"
      ? connectOrg(volunteerId, orgId, memberRef)
      : action === "disconnect"
        ? disconnectOrg(volunteerId, orgId)
        : action === "submit"
          ? submitHours(volunteerId, orgId)
          : { error: "Unknown action" };
  return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
}
