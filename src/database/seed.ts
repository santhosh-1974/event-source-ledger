import { logger } from "../config/logger";
import { disconnectDB, getClient } from "./database";

async function seed(): Promise<void> {
  const client = await getClient();

  try {
    logger.info("Starting database seed...");
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('ledger-system-account-seed', 0))"
    );
    await client.query(`
      WITH seed_accounts (name, ledger_type, category) AS (
        VALUES
          ('Cash', 'ASSET', 'SYSTEM'),
          ('Bank Revenue', 'INCOME', 'SYSTEM'),
          ('ATM Fees', 'INCOME', 'SYSTEM'),
          ('Interest Expense', 'EXPENSE', 'SYSTEM')
      )
      INSERT INTO ledger_accounts (name, ledger_type, category)
      SELECT seed.name, seed.ledger_type::ledger_account_type, seed.category::ledger_account_category
      FROM seed_accounts AS seed
      WHERE NOT EXISTS (
        SELECT 1
        FROM ledger_accounts AS existing
        WHERE existing.name = seed.name
          AND existing.ledger_type = seed.ledger_type::ledger_account_type
          AND existing.category = seed.category::ledger_account_category
      )
    `);
    await client.query("COMMIT");
    logger.info("Database seeded successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await disconnectDB();
  }
}

seed().catch((error: unknown) => {
  logger.error(error, "Failed to seed database");
  process.exitCode = 1;
});
