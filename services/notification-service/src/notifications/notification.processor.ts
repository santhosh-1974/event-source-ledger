import { env } from "../config/env";
import { BankingEvent, parseBankingEvent } from "../events/banking-event.schema";
import type { EmailProvider } from "./email.provider";
import {
  beginNotificationEvent,
  claimDeliveryAttempt,
  completeNotificationEvent,
  ensureDelivery,
  isEmailConsentActive,
  markDeliveryFailed,
  markDeliverySent,
  markDeliverySkipped,
} from "./notification.repository";
import { logger } from "../config/logger";

interface NotificationRecipient {
  customerId: string;
  action: "deposit" | "withdrawal" | "transfer-sent" | "transfer-received";
  amount: string;
  reference: string;
}

export interface NotificationDependencies {
  emailProvider: EmailProvider;
  getCustomerEmail: (customerId: string) => Promise<string>;
  maxAttempts?: number;
  leaseSeconds?: number;
}

function getRecipients(event: BankingEvent): NotificationRecipient[] {
  if (event.eventType === "banking.transfer.completed") {
    return [
      {
        customerId: event.payload.senderCustomerId,
        action: "transfer-sent",
        amount: event.payload.amount,
        reference: event.payload.reference,
      },
      {
        customerId: event.payload.receiverCustomerId,
        action: "transfer-received",
        amount: event.payload.amount,
        reference: event.payload.reference,
      },
    ];
  }

  return [
    {
      customerId: event.payload.customerId,
      action:
        event.eventType === "banking.deposit.completed"
          ? "deposit"
          : "withdrawal",
      amount: event.payload.amount,
      reference: event.payload.reference,
    },
  ];
}

function renderMessage(recipient: NotificationRecipient): {
  subject: string;
  text: string;
} {
  const actionText = {
    deposit: "A deposit was completed",
    withdrawal: "A withdrawal was completed",
    "transfer-sent": "A transfer was sent from your account",
    "transfer-received": "A transfer was received into your account",
  }[recipient.action];

  return {
    subject: "Banking activity notification",
    text: `${actionText} for ${recipient.amount}. Reference: ${recipient.reference}.`,
  };
}

function safeErrorCode(error: unknown): string {
  const name =
    error instanceof Error && error.name.length > 0 && error.name !== "Error"
      ? error.name
      : "DELIVERY_ERROR";
  return /^[A-Za-z0-9_-]{1,100}$/.test(name) ? name : "DELIVERY_ERROR";
}

function deliveryFailure(code: string): Error {
  const error = new Error(`Notification delivery failed (${code})`);
  error.name = code;
  return error;
}

export async function processNotificationEvent(
  input: unknown,
  dependencies: NotificationDependencies
): Promise<{ duplicate: boolean; sent: number; skipped: number }> {
  const event = parseBankingEvent(input);
  const duplicate = await beginNotificationEvent(event);
  if (duplicate) {
    return { duplicate: true, sent: 0, skipped: 0 };
  }

  let sent = 0;
  let skipped = 0;
  const maxAttempts =
    dependencies.maxAttempts ?? env.NOTIFICATION_MAX_ATTEMPTS;
  const leaseSeconds =
    dependencies.leaseSeconds ?? env.NOTIFICATION_SEND_LEASE_SECONDS;

  for (const recipient of getRecipients(event)) {
    await ensureDelivery(event.eventId, recipient.customerId);
    const claim = await claimDeliveryAttempt(
      event.eventId,
      recipient.customerId,
      maxAttempts,
      leaseSeconds
    );

    if (claim.kind === "complete") {
      continue;
    }
    if (claim.kind === "in_progress") {
      throw deliveryFailure("DELIVERY_IN_PROGRESS");
    }
    if (claim.kind === "exhausted") {
      throw deliveryFailure("ATTEMPTS_EXHAUSTED");
    }

    if (!(await isEmailConsentActive(recipient.customerId))) {
      const completed = await markDeliverySkipped(
        claim.deliveryId,
        claim.lockToken,
        claim.attemptNumber
      );
      if (!completed) {
        throw deliveryFailure("DELIVERY_LEASE_LOST");
      }
      skipped += 1;
      continue;
    }

    let messageId: string;
    try {
      const email = await dependencies.getCustomerEmail(recipient.customerId);
      const message = renderMessage(recipient);
      messageId = await dependencies.emailProvider.send({
        recipient: email,
        ...message,
      });
    } catch (error) {
      const errorCode = safeErrorCode(error);
      const recorded = await markDeliveryFailed(
        claim.deliveryId,
        claim.lockToken,
        claim.attemptNumber,
        claim.retryCount,
        maxAttempts,
        errorCode
      );
      if (!recorded) {
        throw deliveryFailure("DELIVERY_LEASE_LOST");
      }
      logger.error(
        {
          eventId: event.eventId,
          deliveryId: claim.deliveryId,
          attemptNumber: claim.attemptNumber,
          errorCode,
        },
        "Notification email delivery failed"
      );
      throw deliveryFailure(errorCode);
    }

    const completed = await markDeliverySent(
      claim.deliveryId,
      claim.lockToken,
      claim.attemptNumber,
      messageId
    );
    if (!completed) {
      throw deliveryFailure("DELIVERY_LEASE_LOST");
    }
    sent += 1;
  }

  await completeNotificationEvent(event.eventId);
  logger.info(
    { eventId: event.eventId, sent, skipped },
    "Notification event processed"
  );
  return { duplicate: false, sent, skipped };
}
