import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import customerServiceApp from "../../services/customer-service/src/app";
import gatewayApp from "../../services/api-gateway/src/app";
import { processNotificationEvent } from "../../services/notification-service/src/notifications/notification.processor";
import {
  replayFailedNotifications,
} from "../../services/notification-service/src/notifications/notification.repository";
import type { BankingEvent } from "../../services/notification-service/src/events/banking-event.schema";
import type { EmailProvider } from "../../services/notification-service/src/notifications/email.provider";
import { authenticatedRequest, registerTestUser } from "../helpers/auth";
import { resetDatabase } from "../helpers/database";
import { query } from "../../src/database/database";

const CONTACT_SECRET = process.env.NOTIFICATION_CUSTOMER_LOOKUP_SECRET!;

beforeEach(async () => {
  await resetDatabase();
});

function depositEvent(customerId: string): BankingEvent {
  const transactionId = crypto.randomUUID();
  return {
    eventId: crypto.randomUUID(),
    eventType: "banking.deposit.completed",
    schemaVersion: 1,
    occurredAt: new Date().toISOString(),
    aggregateType: "transaction",
    aggregateId: transactionId,
    payload: {
      transactionId,
      reference: crypto.randomUUID(),
      customerId,
      accountId: crypto.randomUUID(),
      amount: "12.00",
    },
  };
}

function transferEvent(senderCustomerId: string, receiverCustomerId: string): BankingEvent {
  const transactionId = crypto.randomUUID();
  return {
    eventId: crypto.randomUUID(),
    eventType: "banking.transfer.completed",
    schemaVersion: 1,
    occurredAt: new Date().toISOString(),
    aggregateType: "transaction",
    aggregateId: transactionId,
    payload: {
      transactionId,
      reference: crypto.randomUUID(),
      senderCustomerId,
      receiverCustomerId,
      fromAccountId: crypto.randomUUID(),
      toAccountId: crypto.randomUUID(),
      amount: "25.50",
    },
  };
}

async function setEmailConsent(customerId: string, token: string): Promise<void> {
  const response = await authenticatedRequest(gatewayApp, token)
    .put("/api/v1/notifications/preferences")
    .send({ emailEnabled: true, consent: true });
  expect(response.status).toBe(200);
  expect(response.body.data.emailEnabled).toBe(true);

  const history = await query<{ email_enabled: boolean }>(
    `SELECT email_enabled FROM notification.preference_history
     WHERE customer_id = $1`,
    [customerId]
  );
  expect(history.rows).toHaveLength(1);
}

describe("Notification Service", () => {
  it("requires explicit consent and returns a default-deny preference", async () => {
    const user = await registerTestUser(gatewayApp, {
      name: "Notification Consent User",
      email: "notification-consent@example.com",
      phone: "9876543290",
    });
    const client = authenticatedRequest(gatewayApp, user.token);

    const initial = await client.get("/api/v1/notifications/preferences");
    const rejected = await client
      .put("/api/v1/notifications/preferences")
      .send({ emailEnabled: true });
    const optedIn = await client
      .put("/api/v1/notifications/preferences")
      .send({ emailEnabled: true, consent: true });
    const optedOut = await client
      .put("/api/v1/notifications/preferences")
      .send({ emailEnabled: false });

    expect(initial.status).toBe(200);
    expect(initial.body.data).toMatchObject({
      emailEnabled: false,
      consentedAt: null,
      revokedAt: null,
    });
    expect(rejected.status).toBe(400);
    expect(optedIn.status).toBe(200);
    expect(optedOut.status).toBe(200);
    expect(optedOut.body.data.emailEnabled).toBe(false);

    const history = await query<{ email_enabled: boolean }>(
      `SELECT email_enabled FROM notification.preference_history
       WHERE customer_id = $1 ORDER BY changed_at`,
      [user.customer.id]
    );
    expect(history.rows.map((row) => row.email_enabled)).toEqual([true, false]);
  });

  it("does not send when consent is absent and deduplicates successful event delivery", async () => {
    const user = await registerTestUser(gatewayApp, {
      name: "Notification Delivery User",
      email: "notification-delivery@example.com",
      phone: "9876543291",
    });
    await setEmailConsent(user.customer.id, user.token);
    const event = depositEvent(user.customer.id);
    const emailProvider: EmailProvider = {
      send: vi.fn().mockResolvedValue("ses-message-1"),
    };
    const getCustomerEmail = vi
      .fn()
      .mockResolvedValue(user.customer.email);
    const dependencies = { emailProvider, getCustomerEmail };

    await expect(processNotificationEvent(event, dependencies)).resolves.toEqual({
      duplicate: false,
      sent: 1,
      skipped: 0,
    });
    await expect(processNotificationEvent(event, dependencies)).resolves.toEqual({
      duplicate: true,
      sent: 0,
      skipped: 0,
    });

    expect(emailProvider.send).toHaveBeenCalledTimes(1);
    expect(emailProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: user.customer.email,
        text: expect.stringContaining("12.00"),
      })
    );
    const delivery = await query<{ status: string; attempt_count: number }>(
      `SELECT status, attempt_count
       FROM notification.deliveries WHERE event_id = $1`,
      [event.eventId]
    );
    expect(delivery.rows[0]).toMatchObject({ status: "SENT", attempt_count: 1 });
  });

  it("records default-deny events as skipped without looking up contact details", async () => {
    const customerId = crypto.randomUUID();
    const emailProvider: EmailProvider = { send: vi.fn() };
    const getCustomerEmail = vi.fn();

    await expect(
      processNotificationEvent(depositEvent(customerId), {
        emailProvider,
        getCustomerEmail,
      })
    ).resolves.toMatchObject({ sent: 0, skipped: 1 });

    expect(getCustomerEmail).not.toHaveBeenCalled();
    expect(emailProvider.send).not.toHaveBeenCalled();
  });

  it("sends a transfer notice to both opted-in customers", async () => {
    const sender = await registerTestUser(gatewayApp, {
      name: "Transfer Sender",
      email: "notification-sender@example.com",
      phone: "9876543292",
    });
    const receiver = await registerTestUser(gatewayApp, {
      name: "Transfer Receiver",
      email: "notification-receiver@example.com",
      phone: "9876543293",
    });
    await setEmailConsent(sender.customer.id, sender.token);
    await setEmailConsent(receiver.customer.id, receiver.token);

    const emailProvider: EmailProvider = {
      send: vi.fn().mockResolvedValue("ses-message-id"),
    };
    const getCustomerEmail = vi.fn(async (customerId: string) =>
      customerId === sender.customer.id
        ? sender.customer.email
        : receiver.customer.email
    );

    await expect(
      processNotificationEvent(
        transferEvent(sender.customer.id, receiver.customer.id),
        { emailProvider, getCustomerEmail }
      )
    ).resolves.toMatchObject({ sent: 2, skipped: 0 });

    expect(emailProvider.send).toHaveBeenCalledTimes(2);
    expect(emailProvider.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        recipient: sender.customer.email,
        text: expect.stringContaining("sent from your account"),
      })
    );
    expect(emailProvider.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        recipient: receiver.customer.email,
        text: expect.stringContaining("received into your account"),
      })
    );
  });

  it("bounds delivery attempts and safely replays only failed recipients", async () => {
    const user = await registerTestUser(gatewayApp, {
      name: "Notification Retry User",
      email: "notification-retry@example.com",
      phone: "9876543294",
    });
    await setEmailConsent(user.customer.id, user.token);
    const event = depositEvent(user.customer.id);
    const emailProvider: EmailProvider = {
      send: vi
        .fn()
        .mockRejectedValueOnce(new Error("SES unavailable"))
        .mockRejectedValueOnce(new Error("SES unavailable"))
        .mockResolvedValue("ses-replay-message"),
    };
    const dependencies = {
      emailProvider,
      getCustomerEmail: vi.fn().mockResolvedValue(user.customer.email),
      maxAttempts: 2,
    };

    await expect(processNotificationEvent(event, dependencies)).rejects.toThrow();
    await expect(processNotificationEvent(event, dependencies)).rejects.toThrow();
    await expect(processNotificationEvent(event, dependencies)).rejects.toThrow(
      "ATTEMPTS_EXHAUSTED"
    );
    expect(await replayFailedNotifications(event.eventId)).toBe(1);
    await expect(processNotificationEvent(event, dependencies)).resolves.toMatchObject({
      sent: 1,
      skipped: 0,
    });
    await expect(processNotificationEvent(event, dependencies)).resolves.toMatchObject({
      duplicate: true,
    });

    expect(emailProvider.send).toHaveBeenCalledTimes(3);
    const history = await query<{
      attempt_number: number;
      status: string;
    }>(
      `SELECT attempt_number, status
       FROM notification.delivery_attempts
       ORDER BY attempt_number`
    );
    expect(history.rows).toMatchObject([
      { attempt_number: 1, status: "FAILED" },
      { attempt_number: 2, status: "FAILED" },
      { attempt_number: 3, status: "SENT" },
    ]);
  });

  it("restricts internal customer contact lookup to the notification service secret", async () => {
    const user = await registerTestUser(gatewayApp, {
      name: "Contact Lookup User",
      email: "notification-contact@example.com",
      phone: "9876543295",
    });
    const url = `/api/v1/internal/customers/${user.customer.id}/contact`;

    const denied = await request(customerServiceApp).get(url);
    const allowed = await request(customerServiceApp)
      .get(url)
      .set("x-notification-service-secret", CONTACT_SECRET);

    expect(denied.status).toBe(401);
    expect(allowed.status).toBe(200);
    expect(allowed.body.data).toEqual({
      id: user.customer.id,
      email: user.customer.email,
    });
  });

  it("requires authentication for preference access through the public Gateway", async () => {
    const response = await request(gatewayApp).get(
      "/api/v1/notifications/preferences"
    );

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication required");
  });
});
