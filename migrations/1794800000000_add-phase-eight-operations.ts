import { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE public.banking_beneficiaries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id uuid NOT NULL REFERENCES customer.customers(id) ON DELETE RESTRICT,
      recipient_account_id uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
      display_name varchar(80) NOT NULL CHECK (length(trim(display_name)) > 0),
      status varchar(12) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT banking_beneficiary_unique_recipient
        UNIQUE (customer_id, recipient_account_id)
    );

    CREATE TABLE public.scheduled_transfers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id uuid NOT NULL REFERENCES customer.customers(id) ON DELETE RESTRICT,
      source_account_id uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
      beneficiary_id uuid NOT NULL REFERENCES banking_beneficiaries(id) ON DELETE RESTRICT,
      amount numeric(18, 2) NOT NULL CHECK (amount > 0),
      description varchar(255),
      frequency varchar(8) NOT NULL CHECK (frequency IN ('ONCE', 'WEEKLY', 'MONTHLY')),
      start_at timestamptz NOT NULL,
      next_run_at timestamptz,
      status varchar(12) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED')),
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT scheduled_transfer_next_run_state CHECK (
        (status IN ('ACTIVE', 'PAUSED') AND next_run_at IS NOT NULL)
        OR (status IN ('CANCELLED', 'COMPLETED') AND next_run_at IS NULL)
      )
    );

    CREATE INDEX scheduled_transfers_due_idx
      ON public.scheduled_transfers (next_run_at, id)
      WHERE status = 'ACTIVE';

    CREATE INDEX scheduled_transfers_customer_idx
      ON public.scheduled_transfers (customer_id, created_at DESC);

    CREATE TABLE public.scheduled_transfer_occurrences (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      schedule_id uuid NOT NULL
        REFERENCES scheduled_transfers(id) ON DELETE RESTRICT,
      scheduled_for timestamptz NOT NULL,
      status varchar(12) NOT NULL CHECK (
        status IN ('SUCCEEDED', 'FAILED', 'SKIPPED')
      ),
      attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
      transaction_id uuid UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT,
      error_code varchar(100),
      attempted_at timestamptz,
      completed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT scheduled_occurrence_result_state CHECK (
        (status = 'SUCCEEDED' AND transaction_id IS NOT NULL AND error_code IS NULL)
        OR (status = 'FAILED' AND transaction_id IS NULL AND error_code IS NOT NULL)
        OR (status = 'SKIPPED' AND transaction_id IS NULL)
      ),
      CONSTRAINT scheduled_occurrence_unique
        UNIQUE (schedule_id, scheduled_for)
    );

    CREATE INDEX scheduled_occurrences_schedule_idx
      ON public.scheduled_transfer_occurrences (schedule_id, scheduled_for DESC);

    CREATE INDEX ledger_entries_statement_idx
      ON public.ledger_entries (ledger_account_id, created_at, id)
      INCLUDE (entry_type, amount, transaction_id);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP INDEX public.ledger_entries_statement_idx;
    DROP TABLE public.scheduled_transfer_occurrences;
    DROP TABLE public.scheduled_transfers;
    DROP TABLE public.banking_beneficiaries;
  `);
}
