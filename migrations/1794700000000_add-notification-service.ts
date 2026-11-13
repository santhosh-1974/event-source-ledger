import { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE SCHEMA notification;

    CREATE TABLE notification.preferences (
      customer_id uuid PRIMARY KEY,
      email_enabled boolean NOT NULL DEFAULT false,
      consented_at timestamptz,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT notification_preferences_consent_check CHECK (
        NOT email_enabled OR (consented_at IS NOT NULL AND revoked_at IS NULL)
      )
    );

    CREATE TABLE notification.preference_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id uuid NOT NULL,
      email_enabled boolean NOT NULL,
      changed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE notification.events (
      event_id uuid PRIMARY KEY,
      event_type varchar(100) NOT NULL CHECK (
        event_type IN (
          'banking.deposit.completed',
          'banking.withdrawal.completed',
          'banking.transfer.completed'
        )
      ),
      schema_version smallint NOT NULL CHECK (schema_version = 1),
      status varchar(16) NOT NULL DEFAULT 'PROCESSING' CHECK (
        status IN ('PROCESSING', 'PROCESSED')
      ),
      received_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processed_at timestamptz
    );

    CREATE TABLE notification.deliveries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id uuid NOT NULL REFERENCES notification.events(event_id),
      customer_id uuid NOT NULL,
      channel varchar(10) NOT NULL DEFAULT 'EMAIL' CHECK (channel = 'EMAIL'),
      status varchar(24) NOT NULL DEFAULT 'PENDING' CHECK (
        status IN ('PENDING', 'SENDING', 'SENT', 'SKIPPED_CONSENT', 'FAILED')
      ),
      attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
      retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
      lock_token uuid,
      locked_until timestamptz,
      provider_message_id varchar(256),
      last_error_code varchar(100),
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT notification_delivery_lease_check CHECK (
        (status = 'SENDING' AND lock_token IS NOT NULL AND locked_until IS NOT NULL)
        OR
        (status <> 'SENDING' AND lock_token IS NULL AND locked_until IS NULL)
      ),
      CONSTRAINT notification_delivery_sent_check CHECK (
        (status = 'SENT' AND provider_message_id IS NOT NULL)
        OR
        (status <> 'SENT')
      ),
      CONSTRAINT notification_delivery_unique
        UNIQUE (event_id, customer_id, channel)
    );

    CREATE INDEX notification_delivery_event_idx
      ON notification.deliveries (event_id, status);

    CREATE TABLE notification.delivery_attempts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      delivery_id uuid NOT NULL REFERENCES notification.deliveries(id),
      attempt_number integer NOT NULL CHECK (attempt_number > 0),
      status varchar(24) NOT NULL CHECK (
        status IN ('STARTED', 'SENT', 'FAILED', 'SKIPPED_CONSENT')
      ),
      error_code varchar(100),
      provider_message_id varchar(256),
      started_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at timestamptz,
      CONSTRAINT notification_attempt_unique
        UNIQUE (delivery_id, attempt_number)
    );
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql("DROP SCHEMA notification CASCADE;");
}
