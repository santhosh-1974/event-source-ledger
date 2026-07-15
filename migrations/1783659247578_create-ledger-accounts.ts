import { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType("ledger_account_type", [
    "ASSET",
    "LIABILITY",
    "EQUITY",
    "INCOME",
    "EXPENSE",
  ]);
  pgm.createType("ledger_account_category", [
    "SYSTEM",
    "CUSTOMER",
  ]);
  pgm.createTable("ledger_accounts", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    bank_account_id: {
      type: "uuid",
      references: "bank_accounts",
      onDelete: "SET NULL",
    },
    name: {
      type: "varchar(255)",
      notNull: true,
    },
    ledger_type: {
      type: "ledger_account_type",
      notNull: true,
    },
    category: {
        type: "ledger_account_category",
        notNull: true,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
  });

  pgm.createIndex("ledger_accounts", "bank_account_id");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("ledger_accounts");
  pgm.dropType("ledger_account_type");
  pgm.dropType("ledger_account_category");
}
