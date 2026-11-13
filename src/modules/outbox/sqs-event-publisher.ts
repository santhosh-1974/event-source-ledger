import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

import { env } from "../../config/env";
import { BankingEvent } from "./banking-event.schema";

export interface EventPublisher {
  publish(event: BankingEvent): Promise<string | undefined>;
}

export class SqsEventPublisher implements EventPublisher {
  private readonly client: SQSClient;

  constructor(
    private readonly queueUrl: string,
    client = new SQSClient({ region: env.AWS_REGION })
  ) {
    this.client = client;
  }

  async publish(event: BankingEvent): Promise<string | undefined> {
    const result = await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(event),
        MessageAttributes: {
          eventId: {
            DataType: "String",
            StringValue: event.eventId,
          },
          eventType: {
            DataType: "String",
            StringValue: event.eventType,
          },
          schemaVersion: {
            DataType: "Number",
            StringValue: String(event.schemaVersion),
          },
        },
      })
    );
    return result.MessageId;
  }

  close(): void {
    this.client.destroy();
  }
}
