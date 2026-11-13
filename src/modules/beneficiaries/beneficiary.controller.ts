import { Request, Response } from "express";

import { NotFoundError } from "../../errors/errors";
import {
  addBeneficiary,
  listBeneficiaries,
  setBeneficiaryEnabled,
} from "./beneficiary.service";
import {
  beneficiaryIdSchema,
  createBeneficiarySchema,
  updateBeneficiarySchema,
} from "./beneficiary.schema";

function customerId(req: Request): string {
  if (!req.auth?.customerId) {
    throw new NotFoundError("Authenticated customer not found.");
  }
  return req.auth.customerId;
}

export async function listBeneficiariesHandler(
  req: Request,
  res: Response
): Promise<void> {
  const data = await listBeneficiaries(customerId(req));
  res.status(200).json({ success: true, data });
}

export async function createBeneficiaryHandler(
  req: Request,
  res: Response
): Promise<void> {
  const input = createBeneficiarySchema.parse(req.body);
  const data = await addBeneficiary(customerId(req), input);
  res.status(201).json({ success: true, data });
}

export async function updateBeneficiaryHandler(
  req: Request,
  res: Response
): Promise<void> {
  const input = updateBeneficiarySchema.parse(req.body);
  const data = await setBeneficiaryEnabled(
    customerId(req),
    beneficiaryIdSchema.parse(req.params.beneficiaryId),
    input.enabled
  );
  res.status(200).json({ success: true, data });
}
