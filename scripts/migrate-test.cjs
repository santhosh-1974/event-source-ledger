const path = require("node:path");
const { spawnSync } = require("node:child_process");
const dotenv = require("dotenv");
const { Client } = require("pg");

const envPath = path.resolve(__dirname, "..", ".env.test");
const loaded = dotenv.config({ path: envPath, override: true });

if (loaded.error) throw loaded.error;
if (process.env.DATABASE_NAME !== "ledger_test") {
  throw new Error(
    `Refusing test migrations: DATABASE_NAME must be ledger_test (got ${process.env.DATABASE_NAME || "unset"}).`
  );
}

async function main() {
  const client = new Client({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
  });

  await client.connect();
  try {
    const result = await client.query("SELECT current_database(), current_user");
    const { current_database: database, current_user: user } = result.rows[0];
    console.log(`Migration target: database=${database}, user=${user}`);
    if (database !== "ledger_test") {
      throw new Error(`Refusing test migrations against ${database}.`);
    }
  } finally {
    await client.end();
  }

  const cli = path.resolve(
    __dirname,
    "..",
    "node_modules",
    "node-pg-migrate",
    "bin",
    "node-pg-migrate.js"
  );
  const connectionString = new URL("postgresql://localhost");
  connectionString.hostname = process.env.DATABASE_HOST;
  connectionString.port = process.env.DATABASE_PORT;
  connectionString.username = process.env.DATABASE_USER;
  connectionString.password = process.env.DATABASE_PASSWORD;
  connectionString.pathname = `/${process.env.DATABASE_NAME}`;
  // node-pg-migrate loads .env itself and prefers DATABASE_URL over flags.
  // Override it in the child so the development URL can never win.
  process.env.DATABASE_URL = connectionString.toString();

  const result = spawnSync(
    process.execPath,
    [
      cli,
      "up",
      "--migrations-dir",
      path.resolve(__dirname, "..", "migrations"),
      "--migration-table",
      "pgmigrations",
    ],
    { stdio: "inherit", env: process.env }
  );

  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
