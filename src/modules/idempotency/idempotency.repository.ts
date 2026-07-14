import { PoolClient } from "pg";
import { pool } from "../../database/database";
import { CreateIdempotencyKeyInput, IdempotencyKeyRecord } from "./idempotency.types";

interface IdempotencyKeyRow {
    id: string;
    idempotency_key: string;
    request_hash: string;
    endpoint: string;
    status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
    response: unknown | null;
    created_at: Date;
    expires_at: Date;
}

function mapRow(row: IdempotencyKeyRow): IdempotencyKeyRecord {
    return {
        id: row.id,
        idempotencyKey: row.idempotency_key,
        requestHash: row.request_hash,
        endpoint: row.endpoint,
        status: row.status,
        response: row.response,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
    };
}

export async function findByKey(idempotencyKey: string, client?: PoolClient): Promise<IdempotencyKeyRecord | null> {
    const db = client ?? pool;
    const result = await db.query<IdempotencyKeyRow>(
        `
      SELECT id, idempotency_key, request_hash, endpoint, status, response, created_at, expires_at
      FROM idempotency_keys
      WHERE idempotency_key = $1;
    `,
        [idempotencyKey]
    );

    if (result.rowCount === 0) {
        return null;
    }

    return mapRow(result.rows[0]);
}

export async function create(input: CreateIdempotencyKeyInput, client?: PoolClient): Promise<IdempotencyKeyRecord> {
    const db = client ?? pool;
    const result = await db.query<IdempotencyKeyRow>(
        `
      INSERT INTO idempotency_keys (idempotency_key, request_hash, endpoint, status, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, idempotency_key, request_hash, endpoint, status, response, created_at, expires_at;
    `,
        [input.idempotencyKey, input.requestHash, input.endpoint, "IN_PROGRESS", input.expiresAt]
    );

    return mapRow(result.rows[0]);
}

export async function markCompleted(idempotencyKey: string, response: unknown, client?: PoolClient): Promise<void> {
    const db = client ?? pool;
    await db.query(
        `
      UPDATE idempotency_keys
      SET status = $1,
          response = $2
      WHERE idempotency_key = $3;
    `,
        ["COMPLETED", response, idempotencyKey]
    );
}

export async function markFailed(idempotencyKey: string, client?: PoolClient): Promise<void> {
    const db = client ?? pool;
    await db.query(
        `
      UPDATE idempotency_keys
      SET status = $1
      WHERE idempotency_key = $2;
    `,
        ["FAILED", idempotencyKey]
    );
}
