import { pool } from "../database/database";

export interface CredentialRow {
  id: string;
  customer_id: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

export async function createCredential(
  customerId: string,
  email: string,
  passwordHash: string
): Promise<void> {
  await pool.query(
    `INSERT INTO identity.credentials (customer_id, email, password_hash)
     VALUES ($1, $2, $3)`,
    [customerId, email, passwordHash]
  );
}

export async function findCredentialByEmail(
  email: string
): Promise<CredentialRow | null> {
  const result = await pool.query<CredentialRow>(
    `SELECT id, customer_id, email, password_hash, created_at
     FROM identity.credentials
     WHERE email = $1`,
    [email]
  );
  return result.rows[0] ?? null;
}
