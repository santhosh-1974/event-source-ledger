import { ConflictError, NotFoundError } from "../../errors/errors";
import {
  BeneficiaryRepositoryError,
  BeneficiaryRecord,
  BeneficiaryStatus,
  create as createRecord,
  findAll,
  updateStatus,
} from "./beneficiary.repository";
import { CreateBeneficiaryInput } from "./beneficiary.schema";

function isUniqueViolation(
  error: unknown,
  constraint: string
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === constraint
  );
}

export async function listBeneficiaries(
  customerId: string
): Promise<BeneficiaryRecord[]> {
  return findAll(customerId);
}

export async function addBeneficiary(
  customerId: string,
  input: CreateBeneficiaryInput
): Promise<BeneficiaryRecord> {
  try {
    return await createRecord(
      customerId,
      input.accountNumber,
      input.displayName
    );
  } catch (error) {
    if (error instanceof BeneficiaryRepositoryError) {
      if (error.code === "RECIPIENT_NOT_FOUND") {
        throw new NotFoundError("Recipient account not found.");
      }
      if (error.code === "SELF_BENEFICIARY") {
        throw new ConflictError("Your own accounts cannot be added as beneficiaries.");
      }
      throw new ConflictError("Recipient account is not active.");
    }
    if (isUniqueViolation(error, "banking_beneficiary_unique_recipient")) {
      throw new ConflictError("This recipient is already saved.");
    }
    throw error;
  }
}

export async function setBeneficiaryEnabled(
  customerId: string,
  beneficiaryId: string,
  enabled: boolean
): Promise<BeneficiaryRecord> {
  const status: BeneficiaryStatus = enabled ? "ACTIVE" : "DISABLED";
  const beneficiary = await updateStatus(customerId, beneficiaryId, status);
  if (!beneficiary) {
    throw new NotFoundError("Beneficiary not found or recipient account is inactive.");
  }
  return beneficiary;
}
