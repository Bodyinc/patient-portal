import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Patient-initiated refund requests are disabled. Admins issue refunds from the admin portal. */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Patients cannot request refunds in the portal. Cancel upcoming renewals from Billing, or contact support for payment issues.",
    },
    { status: 403 },
  );
}

export async function GET() {
  return NextResponse.json(
    {
      error: "Patient refund requests are not available.",
      refundRequests: [],
    },
    { status: 403 },
  );
}
