import { PoolClient } from "pg";

import { env } from "../../src/config/env";
import { pool, query } from "../../src/database/database";
import { clearTestAuthentication } from "./auth";

const REQUIRED_TEST_DATABASE = "ledger_test";
const MIGRATION_TABLE = "pgmigrations";

/**
 * Prevent accidental execution against the development database.
 */
export function assertTestEnvironment(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      `Unsafe operation: NODE_ENV is "${process.env.NODE_ENV}", expected "test".`
    );
  }

  if (env.NODE_ENV !== "test") {
    throw new Error(
      `Unsafe operation: env.NODE_ENV is "${env.NODE_ENV}", expected "test".`
    );
  }

  if (env.DATABASE_NAME !== REQUIRED_TEST_DATABASE) {
    throw new Error(
      `Unsafe operation: DATABASE_NAME is "${env.DATABASE_NAME}", expected "${REQUIRED_TEST_DATABASE}".`
    );
  }
}

export async function connectDatabase(): Promise<void> {
  assertTestEnvironment();

  const client = await pool.connect();

  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
}

export async function disconnectDatabase(): Promise<void> {
  assertTestEnvironment();

  await pool.end();
}

async function listTables(
  client: PoolClient
): Promise<Array<{ schemaname: string; tablename: string }>> {
  const result = await client.query<{
    schemaname: string;
    tablename: string;
  }>(
    `
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname IN ('public', 'customer', 'identity')
      AND tablename <> $1
    ORDER BY schemaname, tablename;
    `,
    [MIGRATION_TABLE]
  );

  return result.rows;
}

export async function truncateAllTables(): Promise<void> {
  assertTestEnvironment();

  const client = await pool.connect();

  try {
    const tables = await listTables(client);

    if (tables.length === 0) {
      return;
    }

    const sql = tables
      .map(({ schemaname, tablename }) => `"${schemaname}"."${tablename}"`)
      .join(", ");

    await client.query(
      `TRUNCATE TABLE ${sql} RESTART IDENTITY CASCADE;`
    );
  } finally {
    client.release();
  }
}

export async function clearDatabase(): Promise<void> {
  await truncateAllTables();
}

export async function seedDatabase(): Promise<void> {
  assertTestEnvironment();

  await query(`
    INSERT INTO ledger_accounts
      (name, ledger_type, category)
    VALUES
      ('Cash', 'ASSET', 'SYSTEM'),
      ('Bank Revenue', 'INCOME', 'SYSTEM'),
      ('ATM Fees', 'INCOME', 'SYSTEM'),
      ('Interest Expense', 'EXPENSE', 'SYSTEM');
  `);
}

export async function resetDatabase(): Promise<void> {
  clearTestAuthentication();
  await clearDatabase();
  await seedDatabase();
}
