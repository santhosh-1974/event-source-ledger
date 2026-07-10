import { query } from "../../database/database";
import { CreateAccountInput, UpdateAccountInput } from "./account.schema";
import { Account } from "./account.types";

interface AccountRow {
    id: string;
    name: string;
    ledger_type: string;
    category: string;
    created_at: Date;
}

function mapAccount(row: AccountRow): Account {
    return {
        id: row.id,
        name: row.name,
        type: row.ledger_type as Account["type"],
        category: row.category as Account["category"],
        createdAt: row.created_at,
    };
}

export async function create(data: CreateAccountInput): Promise<Account> {
    const result = await query<AccountRow>(
        `
      INSERT INTO ledger_accounts (name, ledger_type, category)
      VALUES ($1, $2, $3)
      RETURNING id, name, ledger_type, category, created_at;
    `,
        [data.name, data.type, data.category]
    );

    return mapAccount(result.rows[0]);
}

export async function findById(id: string): Promise<Account | null> {
    const result = await query<AccountRow>(
        `
      SELECT id, name, ledger_type, category, created_at
      FROM ledger_accounts
      WHERE id = $1;
    `,
        [id]
    );

    if (result.rowCount === 0) return null;
    return mapAccount(result.rows[0]);
}

export async function findByName(name: string): Promise<Account | null> {
    const result = await query<AccountRow>(
        `
      SELECT id, name, ledger_type, category, created_at
      FROM ledger_accounts
      WHERE name = $1;
    `,
        [name]
    );

    if (result.rowCount === 0) return null;
    return mapAccount(result.rows[0]);
}

export async function findAll(): Promise<Account[]> {
    const result = await query<AccountRow>(
        `
      SELECT id, name, ledger_type, category, created_at
      FROM ledger_accounts
      ORDER BY created_at DESC;
    `
    );

    return result.rows.map(mapAccount);
}

export async function updateById(id: string, data: UpdateAccountInput): Promise<Account | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (data.name !== undefined) {
        fields.push(`name = $${index}`);
        values.push(data.name);
        index += 1;
    }

    if (data.type !== undefined) {
        fields.push(`ledger_type = $${index}`);
        values.push(data.type);
        index += 1;
    }

    if (data.category !== undefined) {
        fields.push(`category = $${index}`);
        values.push(data.category);
        index += 1;
    }

    if (fields.length === 0) {
        return findById(id);
    }

    values.push(id);
    const result = await query<AccountRow>(
        `
      UPDATE ledger_accounts
      SET ${fields.join(", ")}
      WHERE id = $${index}
      RETURNING id, name, ledger_type, category, created_at;
    `,
        values
    );

    if (result.rowCount === 0) return null;
    return mapAccount(result.rows[0]);
}

export async function deleteById(id: string): Promise<boolean> {
    const result = await query(
        `
      DELETE FROM ledger_accounts
      WHERE id = $1;
    `,
        [id]
    );

    return (result.rowCount ?? 0) > 0;
}
