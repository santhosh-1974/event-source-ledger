import { PoolClient } from "pg";

import { getClient } from "../../database/database";
import { BankingEvent, parseBankingEvent } from "./banking-event.schema";

export type BankingEventHandler = (
  event: BankingEvent,
  client: PoolClient
) => Promise<void>;

export async function processBankingEvent(
  consumerName: string,
  input: unknown,
  handler: BankingEventHandler
): Promise<boolean> {
  if (!consumerName.trim() || consumerName.length > 100) {
    throw new Error("Consumer name must contain 1 to 100 characters");
  }

  const event = parseBankingEvent(input);
  const client = await getClient();

  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO banking_event_inbox (consumer_name, event_id, event_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (consumer_name, event_id) DO NOTHING
       RETURNING event_id`,
      [consumerName, event.eventId, event.eventType]
    );

    if (inserted.rowCount !== 1) {
      await client.query("ROLLBACK");
      return false;
    }

    await handler(event, client);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
