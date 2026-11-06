import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { env } from "../config/env";

export const pool = new Pool({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  database: env.POSTGRES_DB,
});

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}
