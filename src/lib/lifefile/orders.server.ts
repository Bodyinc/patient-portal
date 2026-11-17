import "server-only";

import { lifeFileRequest, type LifeFileConfig } from "./client.server";

type LifeFileOrderBody = {
  orderId?: string | number;
  orderID?: string | number;
  id?: string | number;
  order?: { id?: string | number };
};

type LifeFileResponse = {
  type?: "success" | "error";
  message?: string;
  data?: string | number | LifeFileOrderBody;
};

export type LifeFileOrderInput = {
  requestId: string;
  patient: {
    fullName: string;
    dob: string | null;
    sex: string | null;
    streetAddress: string | null;
    apartment: string | null;
    city: string | null;
    stateCode: string | null;
    postalCode: string | null;
    country: string | null;
  };
  provider: {
    fullName: string;
    npi: string | null;
    licenseNumber: string | null;
    licenseState: string | null;
    dea: string | null;
    email: string | null;
    lifeFileProviderId?: string | null;
  };
  prescription: {
    medicineName: string;
    directions: string | null;
    lfProductID: number;
    /** Plan length in months. 1-month sends 1, 2-month sends 2, 3-month sends 3. */
    quantity: number;
  };
  config: LifeFileConfig;
};

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: parts[0],
    };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function mapGender(sex: string | null): "m" | "f" | "u" {
  if (sex === "male") return "m";
  if (sex === "female") return "f";
  return "u";
}

export function extractLifeFileOrderId(response: LifeFileResponse | null | undefined) {
  const responseData = response?.data;
  if (typeof responseData === "string" || typeof responseData === "number") {
    return String(responseData);
  }
  if (responseData && typeof responseData === "object") {
    const nested =
      responseData.orderId ??
      responseData.orderID ??
      responseData.id ??
      responseData.order?.id ??
      null;
    return nested != null ? String(nested) : null;
  }
  return null;
}

export async function createLifeFileOrder(input: LifeFileOrderInput) {
  if (!input.patient.dob) {
    throw new Error("Patient date of birth is required for Life File.");
  }

  if (!input.provider.npi) {
    throw new Error("Provider NPI is required for Life File.");
  }

  const patientName = splitName(input.patient.fullName);
  const providerName = splitName(input.provider.fullName);
  const nameParts = input.provider.fullName.trim().split(/\s+/).filter(Boolean);
  if (nameParts.length < 2 || !providerName.firstName || !providerName.lastName) {
    throw new Error(
      "LifeFile needs the doctor's first and last name. Enter both on the provider profile.",
    );
  }
  const product = input.prescription;
  const quantity = Math.round(Number(product.quantity));
  if (!Number.isFinite(quantity) || quantity < 1) {
    throw new Error("Pharmacy quantity must be the plan length: 1, 2, or 3 months.");
  }

  const payload = {
    message: {
      id: Date.now(),
      sentTime: new Date().toISOString(),
    },

    order: {
      general: {
        referenceId: input.requestId,
        memo: `BodyInc order ${input.requestId}`,
      },

      prescriber: {
        npi: input.provider.npi,
        licenseNumber: input.provider.licenseNumber ?? undefined,
        licenseState: input.provider.licenseState ?? undefined,
        dea: input.provider.dea ?? undefined,
        lastName: providerName.lastName,
        firstName: providerName.firstName,
        email: input.provider.email ?? undefined,
      },

      practice: {
        id: input.config.practiceId,
      },

      patient: {
        firstName: patientName.firstName,
        lastName: patientName.lastName,
        gender: mapGender(input.patient.sex),
        dateOfBirth: input.patient.dob,
        address1: input.patient.streetAddress ?? undefined,
        address2: input.patient.apartment ?? undefined,
        city: input.patient.city ?? undefined,
        state: input.patient.stateCode ?? undefined,
        zip: input.patient.postalCode ?? undefined,
        country: input.patient.country ?? undefined,
      },

      shipping: {
        recipientType: "patient",
        recipientLastName: patientName.lastName,
        recipientFirstName: patientName.firstName,
        addressLine1: input.patient.streetAddress ?? undefined,
        addressLine2: input.patient.apartment ?? undefined,
        city: input.patient.city ?? undefined,
        state: input.patient.stateCode ?? undefined,
        zipCode: input.patient.postalCode ?? undefined,
        country: input.patient.country ?? undefined,
        service: 9,
      },

      // Patient pays Body Inc, and Body Inc pays the pharmacy.
      billing: {
        payorType: "doc",
      },

      rxs: [
        {
          rxType: "new",
          drugName: product.medicineName,
          lfProductID: product.lfProductID,
          quantity,
          directions: product.directions?.trim() || undefined,
          foreignRxNumber: input.requestId,
          uuid: crypto.randomUUID(),
        },
      ],
    },
  };

  console.log("[Life File] Sending order:", {
    requestId: input.requestId,
    medicine: product.medicineName,
    lfProductID: product.lfProductID,
    quantity,
    practiceId: input.config.practiceId,
    username: input.config.apiUsername,
    payorType: "doc",
  });

  const response = await lifeFileRequest<LifeFileResponse>("/order", {
    method: "POST",
    body: payload,
    config: input.config,
  });

  console.log("[Life File] Response:", JSON.stringify(response, null, 2));

  return response;
}
