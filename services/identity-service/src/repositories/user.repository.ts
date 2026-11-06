import { pool } from "../database/database";

export interface CredentialRow {
  id: string;
  customer_id: string;
  password_hash: string;
  created_at: Date;
}

export async function createUser(customerId: string, passwordHash: string): Promise<void> {
  const query = `INSERT INTO users (customer_id, password_hash) VALUES ($1, $2)`;
  await pool.query(query, [customerId, passwordHash]);
}

export async function findByCustomerId(customerId: string): Promise<CredentialRow | null> {
  const result = await pool.query<CredentialRow>(
    `SELECT * FROM users WHERE customer_id = $1`,
    [customerId]
  );
  return result.rows[0] ?? null;
}

export async function findByEmail(email: string): Promise<CredentialRow | null> {
  // Join with customers table to get customer_id by email
  const result = await pool.query<CredentialRow>(
    `SELECT u.* FROM users u INNER JOIN customers c ON u.customer_id = c.id WHERE c.email = $1`,
    [email]
  );
  return result.rows[0] ?? null;
}

