import { NextResponse } from "next/server";
import { addMedication, logDose, removeMedication, requestRefill, setMedicationPicture } from "@/lib/store";

export async function POST(req: Request) {
  const body = await req.json();
  const result =
    body.action === "add"
      ? addMedication(body.seniorId, body.med ?? {})
      : body.action === "remove"
        ? removeMedication(body.medId)
        : body.action === "dose"
          ? logDose(body.medId, body.time, body.status === "skipped" ? "skipped" : "taken")
          : body.action === "refill"
            ? await requestRefill(body.medId)
            : body.action === "picture"
              ? setMedicationPicture(body.medId, body.photo ?? null, body.look)
              : { error: "Unknown action" };
  return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
}
