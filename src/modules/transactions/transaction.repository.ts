import { transaction, TransactionDetailEntry, TransactionDetails } from "./transaction.types";
import { pool } from "../../database/database";
import { PoolClient } from "pg";

interface transactionRow {
    id: string,
    reference: string,
    description: string | null,
    created_at: Date
}
function mapTransaction(row: transactionRow): transaction {
    return {
        id: row.id,
        reference: row.reference,
        description: row.description,
        createdAt: row.created_at
    }
}

export async function create(reference: string, description: string, client?: PoolClient): Promise<transaction> {
    const db = client ?? pool;
    const sql =
        `
        INSERT INTO transactions(reference, description)
        VALUES ($1, $2)
        RETURNING id, reference, description, created_at
    `;
    const result = await db.query<transactionRow>(sql, [reference, description]);
    return mapTransaction(result.rows[0]);
}

export async function findById(id: string, client?: PoolClient): Promise<transaction | null> {
    const db = client ?? pool;
    const sql = `
        SELECT id, reference, description, created_at
        FROM transactions
        WHERE id = $1
    `;
    const result = await db.query<transactionRow>(sql, [id]);
    if (result.rowCount === 0) return null;
    return mapTransaction(result.rows[0]);
}

export async function findByReference(reference: string, client?: PoolClient): Promise<transaction | null> {
    const db = client ?? pool;
    const result = await db.query<transactionRow>(
        `SELECT id, reference, description, created_at FROM transactions WHERE reference = $1;`,
        [reference]
    );
    return result.rowCount === 0 ? null : mapTransaction(result.rows[0]);
}

export async function findDetailsById(id: string, client?: PoolClient): Promise<TransactionDetails | null> {
    const db = client ?? pool;
    const transactionResult = await db.query<transactionRow>(
        "SELECT id, reference, description, created_at FROM transactions WHERE id = $1",
        [id]
    );

    if (transactionResult.rowCount === 0) return null;

    const transaction = mapTransaction(transactionResult.rows[0]);
    const entryResult = await db.query<{
        id: string;
        transaction_id: string;
        ledger_account_id: string;
        bank_account_id: string | null;
        ledger_account_name: string;
        entry_type: "DEBIT" | "CREDIT";
        amount: string;
        created_at: Date;
    }>(
        `
        SELECT
          le.id,
          le.transaction_id,
          le.ledger_account_id,
          la.bank_account_id,
          la.name AS ledger_account_name,
          le.entry_type,
          le.amount,
          le.created_at
        FROM ledger_entries le
        INNER JOIN ledger_accounts la ON la.id = le.ledger_account_id
        WHERE le.transaction_id = $1
        ORDER BY le.created_at ASC, le.id ASC;
        `,
        [id]
    );
    const entries: TransactionDetailEntry[] = entryResult.rows.map((row) => ({
        id: row.id,
        transactionId: row.transaction_id,
        ledgerAccountId: row.ledger_account_id,
        bankAccountId: row.bank_account_id,
        ledgerAccountName: row.ledger_account_name,
        entryType: row.entry_type,
        amount: row.amount,
        createdAt: row.created_at.toISOString(),
    }));

    return {
        transactionId: transaction.id,
        reference: transaction.reference,
        type: transaction.description,
        createdAt: transaction.createdAt.toISOString(),
        entries,
        debitEntries: entries.filter((entry) => entry.entryType === "DEBIT"),
        creditEntries: entries.filter((entry) => entry.entryType === "CREDIT"),
    };
}
