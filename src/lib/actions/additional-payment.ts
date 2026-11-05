"use server";

import { requirePatientSession } from "@/lib/auth/require-patient";
import {
  applyAdditionalPaymentDiscount,
  type AdditionalPaymentDiscountResult,
} from "@/lib/orders/additional-payment";
import { getPatientDisplayIdentity } from "@/lib/profile/identity";

export async function applyAdditionalPaymentPromo(
  requestId: string,
  code: string,
): Promise<AdditionalPaymentDiscountResult> {
  const { user } = await requirePatientSession();
  const identity = await getPatientDisplayIdentity(user.id);
  return applyAdditionalPaymentDiscount({
    userId: user.id,
    email: user.email ?? null,
    name: identity.stripeName,
    requestId,
    code,
  });
}
