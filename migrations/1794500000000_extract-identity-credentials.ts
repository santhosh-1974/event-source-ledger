import { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createSchema("identity");
  pgm.sql(`
    CREATE TABLE identity.credentials (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id uuid NOT NULL UNIQUE,
      email varchar(255) NOT NULL UNIQUE,
      password_hash varchar(255) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    INSERT INTO identity.credentials (id, customer_id, email, password_hash, created_at)
    SELECT users.id, users.customer_id, customers.email, users.password_hash, users.created_at
    FROM users
    INNER JOIN customers ON customers.id = users.customer_id;

    ALTER TABLE users RENAME TO legacy_users;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM identity.credentials AS credentials
        LEFT JOIN customers ON customers.id = credentials.customer_id
        WHERE customers.id IS NULL
      ) THEN
        RAISE EXCEPTION
          'Cannot roll back Identity credentials: a credential has no matching customer';
      END IF;
    END;
    $$;

    INSERT INTO legacy_users (id, customer_id, password_hash, created_at)
    SELECT id, customer_id, password_hash, created_at
    FROM identity.credentials
    ON CONFLICT (customer_id) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          created_at = EXCLUDED.created_at;

    DROP SCHEMA identity CASCADE;
    ALTER TABLE legacy_users RENAME TO users;
  `);
}
