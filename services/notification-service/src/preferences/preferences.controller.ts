import { Request, Response } from "express";
import { z } from "zod";

import {
  findPreference,
  updatePreference,
} from "./preferences.repository";

const updatePreferenceSchema = z
  .object({
    emailEnabled: z.boolean(),
    consent: z.boolean().default(false),
  })
  .strict()
  .refine((value) => !value.emailEnabled || value.consent, {
    message: "Explicit consent is required to enable email notifications",
    path: ["consent"],
  });

function customerIdOrReject(req: Request, res: Response): string | undefined {
  if (!req.customerId) {
    res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });
    return undefined;
  }
  return req.customerId;
}

function responseData(preference: {
  emailEnabled: boolean;
  consentedAt: Date | null;
  revokedAt: Date | null;
}) {
  return {
    emailEnabled: preference.emailEnabled,
    consentedAt: preference.consentedAt?.toISOString() ?? null,
    revokedAt: preference.revokedAt?.toISOString() ?? null,
  };
}

export async function getPreferenceHandler(
  req: Request,
  res: Response
): Promise<void> {
  const customerId = customerIdOrReject(req, res);
  if (!customerId) return;

  const preference = await findPreference(customerId);
  res.status(200).json({
    success: true,
    data: preference
      ? responseData(preference)
      : { emailEnabled: false, consentedAt: null, revokedAt: null },
  });
}

export async function updatePreferenceHandler(
  req: Request,
  res: Response
): Promise<void> {
  const input = updatePreferenceSchema.parse(req.body);
  const customerId = customerIdOrReject(req, res);
  if (!customerId) return;

  const preference = await updatePreference(
    customerId,
    input.emailEnabled
  );
  res.status(200).json({ success: true, data: responseData(preference) });
}
