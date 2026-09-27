import { NextResponse } from "next/server";
import { checkScam, reportSameScam, submitScamReport } from "@/lib/store";
import type { ScamChannel } from "@/lib/types";

const CHANNELS: ScamChannel[] = ["phone", "text", "email", "online", "door", "social", "mail"];
const ROLES = ["senior", "volunteer", "family"] as const;

export async function POST(req: Request) {
  const b = await req.json();
  const role = ROLES.includes(b.reporterRole) ? b.reporterRole : "senior";
  const area = typeof b.area === "string" ? b.area.slice(0, 60) : "Fredericton";
  const result =
    b.action === "check"
      ? await checkScam(String(b.text ?? ""), CHANNELS.includes(b.channel) ? b.channel : "phone", area)
      : b.action === "report"
        ? await submitScamReport({
            analysisId: String(b.analysisId ?? ""),
            reporterId: String(b.reporterId ?? ""),
            reporterRole: role,
            area,
            lostMoney: Boolean(b.lostMoney),
            sharedInfo: Boolean(b.sharedInfo),
          })
        : b.action === "same"
          ? await reportSameScam(String(b.campaignId ?? ""), String(b.reporterId ?? ""), role, area)
          : { error: "Unknown action" };
  return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
}
