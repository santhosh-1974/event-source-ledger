import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

import { env } from "../config/env";
import { logger } from "../config/logger";
import { getCustomerEmail } from "../customers/customer.client";
import { SesEmailProvider } from "./email.provider";
import { processNotificationEvent } from "./notification.processor";

let stopping = false;
let consumerLoop: Promise<void> | null = null;
let abortController: AbortController | null = null;
let sqsClient: SQSClient | null = null;
let emailProvider: SesEmailProvider | null = null;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "name" in error) {
    const name = error.name;
    if (typeof name === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(name)) {
      return name;
    }
  }
  return "CONSUMER_ERROR";
}

async function handleMessage(
  message: {
    Body?: string;
    MessageId?: string;
    ReceiptHandle?: string;
  },
  client: SQSClient,
  signal: AbortSignal,
  provider: SesEmailProvider
): Promise<void> {
  if (!message.Body || !message.ReceiptHandle) {
    logger.error(
      { messageId: message.MessageId },
      "Received SQS message without a body or receipt handle"
    );
    return;
  }

  try {
    await processNotificationEvent(JSON.parse(message.Body), {
      emailProvider: provider,
      getCustomerEmail,
    });
    await client.send(
      new DeleteMessageCommand({
        QueueUrl: env.NOTIFICATION_SQS_QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle,
      }),
      { abortSignal: signal }
    );
  } catch (error) {
    logger.error(
      {
        messageId: message.MessageId,
        errorCode: errorCode(error),
      },
      "Notification message was not acknowledged and will be retried"
    );
  }
}

async function runConsumer(
  client: SQSClient,
  signal: AbortSignal,
  provider: SesEmailProvider
): Promise<void> {
  while (!stopping) {
    try {
      const result = await client.send(
        new ReceiveMessageCommand({
          QueueUrl: env.NOTIFICATION_SQS_QUEUE_URL,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: env.NOTIFICATION_SQS_WAIT_TIME_SECONDS,
          VisibilityTimeout:
            env.NOTIFICATION_SQS_VISIBILITY_TIMEOUT_SECONDS,
          MessageAttributeNames: ["All"],
        }),
        { abortSignal: signal }
      );

      await Promise.all(
        (result.Messages ?? []).map((message) =>
          handleMessage(message, client, signal, provider)
        )
      );
    } catch (error) {
      if (stopping) {
        break;
      }
      logger.error(
        { errorCode: errorCode(error) },
        "Notification SQS polling failed"
      );
      await delay(1_000);
    }
  }
}

export function startNotificationConsumer(): void {
  if (!env.NOTIFICATION_CONSUMER_ENABLED || consumerLoop) {
    return;
  }
  if (!env.NOTIFICATION_SQS_QUEUE_URL) {
    throw new Error(
      "NOTIFICATION_SQS_QUEUE_URL is required when the consumer is enabled"
    );
  }
  if (!env.NOTIFICATION_SES_FROM_EMAIL) {
    throw new Error(
      "NOTIFICATION_SES_FROM_EMAIL is required when the consumer is enabled"
    );
  }

  stopping = false;
  abortController = new AbortController();
  sqsClient = new SQSClient({ region: env.AWS_REGION });
  emailProvider = new SesEmailProvider(
    env.NOTIFICATION_SES_FROM_EMAIL,
    env.AWS_REGION
  );
  consumerLoop = runConsumer(sqsClient, abortController.signal, emailProvider);
  logger.info("Notification SQS consumer started");
}

export async function stopNotificationConsumer(): Promise<void> {
  stopping = true;
  abortController?.abort();
  await consumerLoop;
  sqsClient?.destroy();
  emailProvider?.close();
  consumerLoop = null;
  sqsClient = null;
  emailProvider = null;
  abortController = null;
}
