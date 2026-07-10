import { PoolClient } from "pg";
import { LedgerAccount,LedgerEntry,LedgerType,LedgerCategory,LedgerEntryType} from "./ledger.types";
import { query } from "../../database/database";

interface LedgerAccountRow {
  id: string;
  bank_account_id: string | null;
  name: string;
  ledger_type: LedgerType;
  category: LedgerCategory;
  created_at: Date;
}

interface LedgerEntryRow {
  id: string;
  transaction_id: string;
  ledger_account_id: string;
  entry_type: LedgerEntryType;
  amount: string;
  created_at: Date;
}
function mapLedgerAccount(row: LedgerAccountRow): LedgerAccount {
  return {
    id: row.id,
    bankAccountId: row.bank_account_id,
    name: row.name,
    ledgerType: row.ledger_type,
    category: row.category,
    createdAt: row.created_at,
  };
}

function mapLedgerEntry(row: LedgerEntryRow): LedgerEntry {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    ledgerAccountId: row.ledger_account_id,
    entryType: row.entry_type,
    amount: row.amount,
    createdAt: row.created_at,
  };
}
export async function findCustomerLedgerAccount(
  bankAccountId: string
): Promise<LedgerAccount | null> {
  const result = await query<LedgerAccountRow>(
    `
    SELECT
      id,
      bank_account_id,
      name,
      ledger_type,
      category,
      created_at
    FROM ledger_accounts
    WHERE bank_account_id = $1;
    `,
    [bankAccountId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapLedgerAccount(result.rows[0]);
}


export async function findSystemLedgerAccount(
  name: string
): Promise<LedgerAccount | null> {
  const result = await query<LedgerAccountRow>(
    `
    SELECT
      id,
      bank_account_id,
      name,
      ledger_type,
      category,
      created_at
    FROM ledger_accounts
    WHERE
      name = $1
      AND category = 'SYSTEM';
    `,
    [name]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapLedgerAccount(result.rows[0]);
}


export async function createLedgerEntry(
  client: PoolClient,
  transactionId: string,
  ledgerAccountId: string,
  entryType: LedgerEntryType,
  amount: string
): Promise<LedgerEntry> {
  const result = await client.query<LedgerEntryRow>(
    `
    INSERT INTO ledger_entries (
      transaction_id,
      ledger_account_id,
      entry_type,
      amount
    )
    VALUES ($1,$2,$3,$4)
    RETURNING
      id,
      transaction_id,
      ledger_account_id,
      entry_type,
      amount,
      created_at;
    `,
    [
      transactionId,
      ledgerAccountId,
      entryType,
      amount,
    ]
  );

  return mapLedgerEntry(result.rows[0]);
}