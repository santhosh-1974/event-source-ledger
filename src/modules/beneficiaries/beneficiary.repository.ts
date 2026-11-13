import { PoolClient } from "pg";

import { pool } from "../../database/database";

export type BeneficiaryStatus = "ACTIVE" | "DISABLED";

export interface BeneficiaryRecord {
  id: string;
  displayName: string;
  accountNumberMasked: string;
  status: BeneficiaryStatus;
  createdAt: string;
  updatedAt: string;
}

interface BeneficiaryRow {
  id: string;
  display_name: string;
  account_number: string;
  status: BeneficiaryStatus;
  created_at: Date;
  updated_at: Date;
}

export class BeneficiaryRepositoryError extends Error {
  constructor(
    readonly code:
      | "RECIPIENT_NOT_FOUND"
      | "SELF_BENEFICIARY"
      | "RECIPIENT_NOT_ACTIVE"
  ) {
    super(code);
    this.name = "BeneficiaryRepositoryError";
  }
}

function mapBeneficiary(row: BeneficiaryRow): BeneficiaryRecord {
  return {
    id: row.id,
    displayName: row.display_name,
    accountNumberMasked: `****${row.account_number.slice(-4)}`,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findAll(customerId: string): Promise<BeneficiaryRecord[]> {
  const result = await pool.query<BeneficiaryRow>(
    `SELECT beneficiary.id, beneficiary.display_name, account.account_number,
            beneficiary.status, beneficiary.created_at, beneficiary.updated_at
     FROM banking_beneficiaries AS beneficiary
     INNER JOIN bank_accounts AS account
       ON account.id = beneficiary.recipient_account_id
     WHERE beneficiary.customer_id = $1
     ORDER BY beneficiary.created_at DESC, beneficiary.id`,
    [customerId]
  );
  return result.rows.map(mapBeneficiary);
}

export async function create(
  customerId: string,
  accountNumber: string,
  displayName: string
): Promise<BeneficiaryRecord> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const account = await client.query<{
      id: string;
      customer_id: string;
      status: string;
    }>(
      `SELECT id, customer_id, status
       FROM bank_accounts
       WHERE account_number = $1
       FOR SHARE`,
      [accountNumber]
    );
    const recipient = account.rows[0];
    if (!recipient) {
      throw new BeneficiaryRepositoryError("RECIPIENT_NOT_FOUND");
    }
    if (recipient.customer_id === customerId) {
      throw new BeneficiaryRepositoryError("SELF_BENEFICIARY");
    }
    if (recipient.status !== "ACTIVE") {
      throw new BeneficiaryRepositoryError("RECIPIENT_NOT_ACTIVE");
    }

    const result = await client.query<BeneficiaryRow>(
      `INSERT INTO banking_beneficiaries
         (customer_id, recipient_account_id, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, display_name,
         (SELECT account_number FROM bank_accounts WHERE id = recipient_account_id)
           AS account_number,
         status, created_at, updated_at`,
      [customerId, recipient.id, displayName]
    );
    await client.query("COMMIT");
    return mapBeneficiary(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateStatus(
  customerId: string,
  beneficiaryId: string,
  status: BeneficiaryStatus,
  client = pool
): Promise<BeneficiaryRecord | null> {
  const result = await client.query<BeneficiaryRow>(
    `UPDATE banking_beneficiaries AS beneficiary
     SET status = $3, updated_at = CURRENT_TIMESTAMP
     FROM bank_accounts AS account
     WHERE beneficiary.id = $1
       AND beneficiary.customer_id = $2
       AND account.id = beneficiary.recipient_account_id
       AND ($3 = 'DISABLED' OR account.status = 'ACTIVE')
     RETURNING beneficiary.id, beneficiary.display_name,
       account.account_number, beneficiary.status,
       beneficiary.created_at, beneficiary.updated_at`,
    [beneficiaryId, customerId, status]
  );
  return result.rows[0] ? mapBeneficiary(result.rows[0]) : null;
}

export async function findOwnedBeneficiary(
  customerId: string,
  beneficiaryId: string,
  client: PoolClient,
  lock = false
): Promise<{
  id: string;
  recipientAccountId: string;
  status: BeneficiaryStatus;
} | null> {
  const result = await client.query<{
    id: string;
    recipient_account_id: string;
    status: BeneficiaryStatus;
  }>(
    `SELECT id, recipient_account_id, status
     FROM banking_beneficiaries
     WHERE id = $1 AND customer_id = $2
     ${lock ? "FOR SHARE" : ""}`,
    [beneficiaryId, customerId]
  );
  const row = result.rows[0];
  return row
    ? {
        id: row.id,
        recipientAccountId: row.recipient_account_id,
        status: row.status,
      }
    : null;
}
