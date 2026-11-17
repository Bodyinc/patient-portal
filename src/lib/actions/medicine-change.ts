"use server";

import { requirePatientSession } from "@/lib/auth/require-patient";
import { respondToMedicineChangeForPatient } from "@/lib/orders/medicine-change";

export async function respondToMedicineChange(
  requestId: string,
  decision: "approve" | "decline",
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { user } = await requirePatientSession();
  return respondToMedicineChangeForPatient({
    userId: user.id,
    requestId,
    decision,
  });
}
