import { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType("bank_account_type", [
    "SAVINGS",
    "CURRENT",
  ]);

  pgm.createType("bank_account_status", [
    "ACTIVE",
    "BLOCKED",
    "CLOSED",
  ]);

  pgm.createTable("bank_accounts", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    customer_id: {
      type: "uuid",
      notNull: true,
      references: "customers",
      onDelete: "RESTRICT",
    },
    account_number: {
      type: "varchar(20)",
      notNull: true,
      unique: true,
    },
    account_type: {
      type: "bank_account_type",
      notNull: true,
    },
    status: {
      type: "bank_account_status",
      notNull: true,
      default: "ACTIVE",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
  });
  pgm.createIndex("bank_accounts", "customer_id");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("bank_accounts");
  pgm.dropType("bank_account_status");
  pgm.dropType("bank_account_type");
}