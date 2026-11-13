import { getClient } from "../../database/database";
import { BadRequestError, NotFoundError } from "../../errors/errors";

export interface StatementEntry {
  transactionId: string;
  reference: string;
  description: string | null;
  entryType: "DEBIT" | "CREDIT";
  amount: string;
  runningBalance: string;
  createdAt: string;
}

export interface AccountStatement {
  accountNumberMasked: string;
  from: string;
  to: string;
  snapshotAt: string;
  openingBalance: string;
  totalDebits: string;
  totalCredits: string;
  closingBalance: string;
  entries: StatementEntry[];
}

const MAX_STATEMENT_ENTRIES = 5_000;

function toCents(amount: string): bigint {
  const negative = amount.startsWith("-");
  const normalized = negative ? amount.slice(1) : amount;
  const [whole, fraction = ""] = normalized.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return negative ? -cents : cents;
}

function fromCents(cents: bigint): string {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const formatted = `${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
  return negative ? `-${formatted}` : formatted;
}

export async function getAccountStatement(
  customerId: string,
  accountNumber: string,
  from: string,
  to: string
): Promise<AccountStatement> {
  const startAt = new Date(`${from}T00:00:00.000Z`);
  const endExclusive = new Date(`${to}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  if (endExclusive <= startAt) {
    throw new BadRequestError("Statement end date must be on or after start date.");
  }
  const rangeDays =
    (endExclusive.getTime() - startAt.getTime()) / (24 * 60 * 60 * 1000);
  if (rangeDays > 366) {
    throw new BadRequestError("Statement date range cannot exceed 366 days.");
  }

  const client = await getClient();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const accountResult = await client.query<{
      account_number: string;
      ledger_account_id: string;
    }>(
      `SELECT account.account_number, ledger.id AS ledger_account_id
       FROM bank_accounts AS account
       INNER JOIN ledger_accounts AS ledger
         ON ledger.bank_account_id = account.id
       WHERE account.account_number = $1 AND account.customer_id = $2`,
      [accountNumber, customerId]
    );
    const account = accountResult.rows[0];
    if (!account) {
      throw new NotFoundError("Account not found.");
    }

    const snapshotResult = await client.query<{ snapshot_at: Date }>(
      "SELECT transaction_timestamp() AS snapshot_at"
    );
    const totals = await client.query<{
      opening_balance: string;
      total_debits: string;
      total_credits: string;
      closing_balance: string;
    }>(
      `SELECT
         COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN -amount ELSE amount END)
           FILTER (WHERE created_at < $2), 0)::numeric(18, 2)::text
           AS opening_balance,
         COALESCE(SUM(amount) FILTER (
           WHERE created_at >= $2 AND created_at < $3 AND entry_type = 'DEBIT'
         ), 0)::numeric(18, 2)::text AS total_debits,
         COALESCE(SUM(amount) FILTER (
           WHERE created_at >= $2 AND created_at < $3 AND entry_type = 'CREDIT'
         ), 0)::numeric(18, 2)::text AS total_credits,
         COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN -amount ELSE amount END)
           FILTER (WHERE created_at < $3), 0)::numeric(18, 2)::text
           AS closing_balance
       FROM ledger_entries
       WHERE ledger_account_id = $1 AND created_at < $3`,
      [account.ledger_account_id, startAt, endExclusive]
    );
    const entriesResult = await client.query<{
      transaction_id: string;
      reference: string;
      description: string | null;
      entry_type: "DEBIT" | "CREDIT";
      amount: string;
      created_at: Date;
    }>(
      `SELECT tx.id AS transaction_id, tx.reference,
              tx.description, entry.entry_type, entry.amount::text,
              entry.created_at
       FROM ledger_entries AS entry
       INNER JOIN transactions AS tx
         ON tx.id = entry.transaction_id
       WHERE entry.ledger_account_id = $1
         AND entry.created_at >= $2 AND entry.created_at < $3
       ORDER BY entry.created_at, entry.id
       LIMIT $4`,
      [
        account.ledger_account_id,
        startAt,
        endExclusive,
        MAX_STATEMENT_ENTRIES + 1,
      ]
    );
    if (entriesResult.rows.length > MAX_STATEMENT_ENTRIES) {
      throw new BadRequestError(
        `Statement contains more than ${MAX_STATEMENT_ENTRIES} entries; narrow the date range.`
      );
    }

    const total = totals.rows[0];
    let runningBalance = toCents(total.opening_balance);
    const entries = entriesResult.rows.map((row) => {
      const cents = toCents(row.amount);
      runningBalance += row.entry_type === "CREDIT" ? cents : -cents;
      return {
        transactionId: row.transaction_id,
        reference: row.reference,
        description: row.description,
        entryType: row.entry_type,
        amount: row.amount,
        runningBalance: fromCents(runningBalance),
        createdAt: row.created_at.toISOString(),
      };
    });

    if (runningBalance !== toCents(total.closing_balance)) {
      throw new Error("Statement entries do not reconcile to the ledger balance");
    }

    await client.query("COMMIT");
    return {
      accountNumberMasked: `****${account.account_number.slice(-4)}`,
      from,
      to,
      snapshotAt: snapshotResult.rows[0].snapshot_at.toISOString(),
      openingBalance: total.opening_balance,
      totalDebits: total.total_debits,
      totalCredits: total.total_credits,
      closingBalance: total.closing_balance,
      entries,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
