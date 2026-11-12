import { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE SCHEMA customer;
    ALTER TABLE public.customers SET SCHEMA customer;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE customer.customers SET SCHEMA public;
    DROP SCHEMA customer;
  `);
}
