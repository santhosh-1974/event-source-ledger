import { transaction } from "./transaction.types";
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