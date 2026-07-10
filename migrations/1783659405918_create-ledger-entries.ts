import { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType("ledger_entry_type", [
    "DEBIT",
    "CREDIT",
  ]);

  pgm.createTable("ledger_entries", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    transaction_id: {
      type: "uuid",
      notNull: true,
      references: "transactions",
      onDelete: "RESTRICT",
    },
    ledger_account_id: {
      type: "uuid",
      notNull: true,
      references: "ledger_accounts",
      onDelete: "RESTRICT",
    },
    entry_type: {
      type: "ledger_entry_type",
      notNull: true,
    },
    amount: {
      type: "numeric(18,2)",
      notNull: true,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
  });

  pgm.addConstraint(
    "ledger_entries",
    "ledger_entries_amount_positive",
    "CHECK (amount > 0)"
  );

  pgm.createIndex("ledger_entries", "transaction_id");
  pgm.createIndex("ledger_entries", "ledger_account_id");
  pgm.createIndex("ledger_entries", "created_at");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("ledger_entries");
  pgm.dropType("ledger_entry_type");
}