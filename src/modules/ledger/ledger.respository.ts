import { PoolClient } from "pg";
import { LedgerAccount, LedgerEntry, LedgerType, LedgerCategory, LedgerEntryType } from "./ledger.types";
import { pool } from "../../database/database";
import { transactionHistoryItem, transactionHistoryResult } from "../banking/banking.types";

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
    bankAccountId: string,
    client?: PoolClient
): Promise<LedgerAccount | null> {
    const db = client ?? pool;
    const result = await db.query<LedgerAccountRow>(
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
    name: string,
    client?: PoolClient
): Promise<LedgerAccount | null> {
    const db = client ?? pool;
    const result = await db.query<LedgerAccountRow>(
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
    transactionId: string,
    ledgerAccountId: string,
    entryType: LedgerEntryType,
    amount: string,
    client?: PoolClient
): Promise<LedgerEntry> {
    const db = client ?? pool;
    const result = await db.query<LedgerEntryRow>(
        `
    INSERT INTO ledger_entries (
      transaction_id,
      ledger_account_id,
      entry_type,
      amount
    )
    VALUES ($1, $2, $3, $4)
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

export async function calculateLedgerBalance(
    ledgerAccountId: string,
    client?: PoolClient
): Promise<string> {
    const db = client ?? pool;
    const result = await db.query<{ balance: string }>(
        `
    SELECT COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN -amount ELSE amount END), 0) AS balance
    FROM ledger_entries
    WHERE ledger_account_id = $1;
    `,
        [ledgerAccountId]
    );

    return result.rows[0]?.balance ?? "0";
}

export async function calculateLedgerEntryTotal(
    transactionId: string,
    client?: PoolClient,
    entryType?: "DEBIT" | "CREDIT"
): Promise<string> {
    const db = client ?? pool;
    const result = await db.query<{ total: string }>(
        `
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM ledger_entries
    WHERE transaction_id = $1
      AND ($2::ledger_entry_type IS NULL OR entry_type = $2);
    `,
        [transactionId, entryType ?? null]
    );

    return result.rows[0]?.total ?? "0";
}

export async function findTransactionHistory(
    ledgerAccountId: string,
    page: number,
    limit: number,
    client?: PoolClient
): Promise<transactionHistoryResult> {
    const db = client ?? pool;
    const normalizedPage = Math.max(1, page);
    const normalizedLimit = Math.min(100, Math.max(1, limit));
    const offset = (normalizedPage - 1) * normalizedLimit;

    const countResult = await db.query<{ total: string }>(
        `
        SELECT COUNT(*)::text AS total
        FROM ledger_entries le
        INNER JOIN transactions t ON t.id = le.transaction_id
        WHERE le.ledger_account_id = $1;
        `,
        [ledgerAccountId]
    );

    const totalRecords = Number(countResult.rows[0]?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalRecords / normalizedLimit));

    const rows = await db.query<{
        transaction_id: string;
        reference: string;
        entry_type: LedgerEntryType;
        amount: string;
        description: string | null;
        created_at: Date;
    }>(
        `
        SELECT
          le.transaction_id AS transaction_id,
          t.reference AS reference,
          le.entry_type AS entry_type,
          le.amount AS amount,
          t.description AS description,
          le.created_at AS created_at
        FROM ledger_entries le
        INNER JOIN transactions t ON t.id = le.transaction_id
        WHERE le.ledger_account_id = $1
        ORDER BY le.created_at DESC, le.transaction_id DESC
        LIMIT $2 OFFSET $3;
        `,
        [ledgerAccountId, normalizedLimit, offset]
    );

    const transactions: transactionHistoryItem[] = rows.rows.map((row) => ({
        transactionId: row.transaction_id,
        reference: row.reference,
        entryType: row.entry_type,
        amount: row.amount,
        description: row.description,
        createdAt: row.created_at.toISOString(),
    }));

    return {
        transactions,
        pagination: {
            page: normalizedPage,
            limit: normalizedLimit,
            totalRecords,
            totalPages,
        },
    };
}