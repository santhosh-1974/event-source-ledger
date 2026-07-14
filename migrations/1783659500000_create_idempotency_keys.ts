import { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType("idempotency_status", [
    "IN_PROGRESS",
    "COMPLETED",
    "FAILED",
  ]);

  pgm.createTable("idempotency_keys", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    idempotency_key: {
      type: "varchar(255)",
      notNull: true,
      unique: true,
    },

    request_hash: {
      type: "varchar(64)",
      notNull: true,
    },

    endpoint: {
      type: "varchar(255)",
      notNull: true,
    },

    status: {
      type: "idempotency_status",
      notNull: true,
      default: "IN_PROGRESS",
    },

    response: {
      type: "jsonb",
    },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },

    expires_at: {
      type: "timestamptz",
      notNull: true,
    },
  });

  pgm.createIndex("idempotency_keys", ["expires_at"], {
    name: "idempotency_keys_expires_at_idx",
  });
  pgm.createIndex("idempotency_keys", ["status"], {
    name: "idempotency_keys_status_idx",
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("idempotency_keys");
  pgm.dropType("idempotency_status");
}