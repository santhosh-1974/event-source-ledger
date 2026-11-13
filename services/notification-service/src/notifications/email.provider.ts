import {
  SESv2Client,
  SendEmailCommand,
} from "@aws-sdk/client-sesv2";

export interface EmailProvider {
  send(input: {
    recipient: string;
    subject: string;
    text: string;
  }): Promise<string>;
}

export class SesEmailProvider implements EmailProvider {
  private readonly client: SESv2Client;

  constructor(
    private readonly fromAddress: string,
    region: string
  ) {
    this.client = new SESv2Client({ region });
  }

  async send(input: {
    recipient: string;
    subject: string;
    text: string;
  }): Promise<string> {
    const result = await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.fromAddress,
        Destination: { ToAddresses: [input.recipient] },
        Content: {
          Simple: {
            Subject: { Data: input.subject, Charset: "UTF-8" },
            Body: { Text: { Data: input.text, Charset: "UTF-8" } },
          },
        },
      })
    );
    if (!result.MessageId) {
      throw new Error("SES response did not include a message ID");
    }
    return result.MessageId;
  }

  close(): void {
    this.client.destroy();
  }
}
