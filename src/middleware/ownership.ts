import { NextFunction, Request, Response } from "express";

import { pool } from "../database/database";
import { NotFoundError } from "../errors/errors";

function accountNumbersFromRequest(req: Request, keys: string[], source: "body" | "params"): string[] | null {
  const container = source === "body" ? req.body as Record<string, unknown> : req.params as Record<string, unknown>;
  const values = keys.map((key) => container[key]);
  if (values.some((value) => typeof value !== "string")) return null;
  const normalized = (values as string[]).map((value) => value.trim());
  if (normalized.some((value) => value.length === 0 || value.length > 20)) return null;
  return [...new Set(normalized)];
}

export function requireOwnedAccounts(keys: string[], source: "body" | "params") {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const accountNumbers = accountNumbersFromRequest(req, keys, source);
    if (!accountNumbers) {
      next(); // Let the request schema return its normal validation response.
      return;
    }

    try {
      const result = await pool.query<{ account_number: string }>(
        `
        SELECT account_number
        FROM bank_accounts
        WHERE account_number = ANY($1::varchar[])
          AND customer_id = $2
        `,
        [accountNumbers, req.auth!.customerId]
      );
      if (result.rowCount !== accountNumbers.length) {
        next(new NotFoundError("Account not found."));
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export async function requireOwnedTransaction(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const transactionId = req.params.transactionId;
  if (typeof transactionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(transactionId)) {
    next(); // Preserve controller/schema validation for malformed identifiers.
    return;
  }

  try {
    const result = await pool.query<{ owns_transaction: boolean }>(
      `
      SELECT EXISTS (
        SELECT 1
        FROM ledger_entries le
        INNER JOIN ledger_accounts la ON la.id = le.ledger_account_id
        INNER JOIN bank_accounts ba ON ba.id = la.bank_account_id
        WHERE le.transaction_id = $1
          AND ba.customer_id = $2
      ) AS owns_transaction
      `,
      [transactionId, req.auth!.customerId]
    );
    if (!result.rows[0]?.owns_transaction) {
      next(new NotFoundError("Transaction not found."));
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}
