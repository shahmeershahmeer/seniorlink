import { NextResponse } from "next/server";
import { donate } from "@/lib/store";

// Demo mode: records the pledge only. A real deployment would hand off to a payment
// provider (e.g. Stripe Checkout or CanadaHelps) and record the donation from its webhook.
export async function POST(req: Request) {
  const { fundId, amount, monthly, name } = await req.json();
  const result = donate(String(fundId), Number(amount), Boolean(monthly), typeof name === "string" ? name.slice(0, 60) : null);
  return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
}
