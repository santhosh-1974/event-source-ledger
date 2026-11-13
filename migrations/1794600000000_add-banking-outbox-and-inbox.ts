import { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE public.banking_outbox (
      id uuid PRIMARY KEY,
      event_type varchar(100) NOT NULL CHECK (
        event_type IN (
          'banking.deposit.completed',
          'banking.withdrawal.completed',
          'banking.transfer.completed'
        )
      ),
      schema_version smallint NOT NULL CHECK (schema_version = 1),
      aggregate_type varchar(50) NOT NULL CHECK (aggregate_type = 'transaction'),
      aggregate_id uuid NOT NULL,
      occurred_at timestamptz NOT NULL,
      payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
      status varchar(16) NOT NULL DEFAULT 'PENDING' CHECK (
        status IN ('PENDING', 'IN_PROGRESS', 'PUBLISHED', 'DEAD')
      ),
      attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
      available_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      lock_token uuid,
      locked_until timestamptz,
      published_at timestamptz,
      queue_message_id varchar(256),
      last_error varchar(1000),
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT banking_outbox_lease_state_check CHECK (
        (status = 'IN_PROGRESS' AND lock_token IS NOT NULL AND locked_until IS NOT NULL)
        OR
        (status <> 'IN_PROGRESS' AND lock_token IS NULL AND locked_until IS NULL)
      ),
      CONSTRAINT banking_outbox_published_state_check CHECK (
        (status = 'PUBLISHED' AND published_at IS NOT NULL)
        OR
        (status <> 'PUBLISHED' AND published_at IS NULL)
      )
    );

    CREATE INDEX banking_outbox_available_idx
      ON public.banking_outbox (available_at, occurred_at, id)
      WHERE status IN ('PENDING', 'IN_PROGRESS');

    CREATE INDEX banking_outbox_lease_idx
      ON public.banking_outbox (locked_until)
      WHERE status = 'IN_PROGRESS';

    CREATE TABLE public.banking_event_inbox (
      consumer_name varchar(100) NOT NULL,
      event_id uuid NOT NULL,
      event_type varchar(100) NOT NULL,
      processed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (consumer_name, event_id)
    );
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE public.banking_event_inbox;
    DROP TABLE public.banking_outbox;
  `);
}
