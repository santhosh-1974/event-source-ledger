import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

import { env } from "../config/env";

export const pool = new Pool({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  database: env.POSTGRES_DB,
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (error) => {
  console.error("[notification-service] Unexpected PostgreSQL pool error", error);
});

export async function connectDB(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1 FROM notification.preferences LIMIT 0");
  } finally {
    client.release();
  }
}

export async function disconnectDB(): Promise<void> {
  await pool.end();
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export async function query<T extends QueryResultRow>(
  text: string,
  values: unknown[] = []
): Promise<QueryResult<T>> {
  return pool.query<T>(text, values);
}
