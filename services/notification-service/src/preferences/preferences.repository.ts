import { getClient, query } from "../database/database";

export interface NotificationPreference {
  customerId: string;
  emailEnabled: boolean;
  consentedAt: Date | null;
  revokedAt: Date | null;
}

interface PreferenceRow {
  customer_id: string;
  email_enabled: boolean;
  consented_at: Date | null;
  revoked_at: Date | null;
}

function mapPreference(row: PreferenceRow): NotificationPreference {
  return {
    customerId: row.customer_id,
    emailEnabled: row.email_enabled,
    consentedAt: row.consented_at,
    revokedAt: row.revoked_at,
  };
}

export async function findPreference(
  customerId: string
): Promise<NotificationPreference | null> {
  const result = await query<PreferenceRow>(
    `SELECT customer_id, email_enabled, consented_at, revoked_at
     FROM notification.preferences
     WHERE customer_id = $1`,
    [customerId]
  );
  return result.rows[0] ? mapPreference(result.rows[0]) : null;
}

export async function updatePreference(
  customerId: string,
  emailEnabled: boolean
): Promise<NotificationPreference> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const result = await client.query<PreferenceRow>(
      `INSERT INTO notification.preferences (
         customer_id, email_enabled, consented_at, revoked_at
       )
       VALUES (
         $1, $2,
         CASE WHEN $2 THEN CURRENT_TIMESTAMP ELSE NULL END,
         CASE WHEN $2 THEN NULL ELSE CURRENT_TIMESTAMP END
       )
       ON CONFLICT (customer_id) DO UPDATE
       SET email_enabled = EXCLUDED.email_enabled,
           consented_at = CASE
             WHEN EXCLUDED.email_enabled THEN CURRENT_TIMESTAMP
             ELSE notification.preferences.consented_at
           END,
           revoked_at = CASE
             WHEN EXCLUDED.email_enabled THEN NULL
             ELSE CURRENT_TIMESTAMP
           END,
           updated_at = CURRENT_TIMESTAMP
       RETURNING customer_id, email_enabled, consented_at, revoked_at`,
      [customerId, emailEnabled]
    );

    await client.query(
      `INSERT INTO notification.preference_history (
         customer_id, email_enabled, changed_at
       )
       VALUES ($1, $2, CURRENT_TIMESTAMP)`,
      [customerId, emailEnabled]
    );
    await client.query("COMMIT");
    return mapPreference(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
