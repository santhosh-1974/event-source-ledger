import { PoolClient } from "pg";
import { pool } from "../../database/database";
import { CreateAccountInput, UpdateAccountInput } from "./account.schema";
import { AccountStatus, AccountType, BankAccount } from "./account.types";

interface BankAccountRow {
    id: string;
    account_number: string;
    customer_id: string;
    account_type: AccountType;
    status: AccountStatus;
    created_at: Date;
}

function mapBankAccount(row: BankAccountRow): BankAccount {
    return {
        id: row.id,
        accountNumber: row.account_number,
        customerId: row.customer_id,
        accountType: row.account_type,
        status: row.status as AccountStatus,
        createdAt: row.created_at,
    };
}

export async function create(data: CreateAccountInput, client?: PoolClient): Promise<BankAccount> {
    const db = client ?? pool;
    const result = await db.query<BankAccountRow>(
        `
      INSERT INTO bank_accounts (account_number, customer_id, account_type, status)
      VALUES ($1, $2, $3, $4)
      RETURNING id, account_number, customer_id, account_type, status, created_at;
    `,
        [data.accountNumber, data.customerId, data.accountType, data.status ?? "ACTIVE"]
    );

    return mapBankAccount(result.rows[0]);
}

export async function findById(id: string, client?: PoolClient): Promise<BankAccount | null> {
    const db = client ?? pool;
    const result = await db.query<BankAccountRow>(
        `
      SELECT id, account_number, customer_id, account_type, status, created_at
      FROM bank_accounts
      WHERE id = $1;
    `,
        [id]
    );

    if (result.rowCount === 0) return null;
    return mapBankAccount(result.rows[0]);
}

export async function findByAccountNumber(accountNumber: string, client?: PoolClient): Promise<BankAccount | null> {
    const db = client ?? pool;
    const result = await db.query<BankAccountRow>(
        `
      SELECT id, account_number, customer_id, account_type, status, created_at
      FROM bank_accounts
      WHERE account_number = $1;
    `,
        [accountNumber]
    );

    if (result.rowCount === 0) return null;
    return mapBankAccount(result.rows[0]);
}

export async function findByName(name: string, client?: PoolClient): Promise<BankAccount | null> {
    return findByAccountNumber(name, client);
}

export async function findAll(client?: PoolClient): Promise<BankAccount[]> {
    const db = client ?? pool;
    const result = await db.query<BankAccountRow>(
        `
      SELECT id, account_number, customer_id, account_type, status, created_at
      FROM bank_accounts
      ORDER BY created_at DESC;
    `
    );

    return result.rows.map(mapBankAccount);
}

export async function updateById(id: string, data: UpdateAccountInput, client?: PoolClient): Promise<BankAccount | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (data.accountNumber !== undefined) {
        fields.push(`account_number = $${index}`);
        values.push(data.accountNumber);
        index += 1;
    }

    if (data.accountType !== undefined) {
        fields.push(`account_type = $${index}`);
        values.push(data.accountType);
        index += 1;
    }

    if (data.status !== undefined) {
        fields.push(`status = $${index}`);
        values.push(data.status);
        index += 1;
    }

    if (fields.length === 0) {
        return findById(id, client);
    }

    values.push(id);
    const db = client ?? pool;
    const result = await db.query<BankAccountRow>(
        `
      UPDATE bank_accounts
      SET ${fields.join(", ")}
      WHERE id = $${index}
      RETURNING id, account_number, customer_id, account_type, status, created_at;
    `,
        values
    );

    if (result.rowCount === 0) return null;
    return mapBankAccount(result.rows[0]);
}

export async function deleteById(id: string, client?: PoolClient): Promise<boolean> {
    const db = client ?? pool;
    const result = await db.query(
        `
      DELETE FROM bank_accounts
      WHERE id = $1;
    `,
        [id]
    );

    return (result.rowCount ?? 0) > 0;
}

export async function updateStatus(accountNumber: string, status: AccountStatus, client?: PoolClient): Promise<BankAccount | null> {
    const db = client ?? pool;
    const result = await db.query<BankAccountRow>(
        `
      UPDATE bank_accounts
      SET status = $1
      WHERE account_number = $2
      RETURNING id, account_number, customer_id, account_type, status, created_at;
    `,
        [status, accountNumber]
    );

    if (result.rowCount === 0) return null;
    return mapBankAccount(result.rows[0]);
}

export async function findBankAccountByNumber(accountNumber: string, client?: PoolClient): Promise<BankAccount | null> {
    return findByAccountNumber(accountNumber, client);
}

export async function findBankAccountByNumberForUpdate(accountNumber: string, client?: PoolClient): Promise<BankAccount | null> {
    const db = client ?? pool;
    const result = await db.query<BankAccountRow>(
        `
      SELECT id, account_number, customer_id, account_type, status, created_at
      FROM bank_accounts
      WHERE account_number = $1
      FOR UPDATE;
    `,
        [accountNumber]
    );

    if (result.rowCount === 0) return null;

    const row = result.rows[0];
    return {
        id: row.id,
        accountNumber: row.account_number,
        customerId: row.customer_id,
        accountType: row.account_type,
        status: row.status,
        createdAt: row.created_at,
    };
}

export async function findBankAccountByIdForUpdate(id: string, client?: PoolClient): Promise<BankAccount | null> {
    const db = client ?? pool;
    const result = await db.query<BankAccountRow>(
        `
      SELECT id, account_number, customer_id, account_type, status, created_at
      FROM bank_accounts
      WHERE id = $1
      FOR UPDATE;
    `,
        [id]
    );

    if (result.rowCount === 0) return null;

    const row = result.rows[0];
    return {
        id: row.id,
        accountNumber: row.account_number,
        customerId: row.customer_id,
        accountType: row.account_type,
        status: row.status as AccountStatus,
        createdAt: row.created_at,
    };
}



