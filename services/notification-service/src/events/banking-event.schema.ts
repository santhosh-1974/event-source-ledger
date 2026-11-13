import { z } from "zod";

const uuid = z.uuid();
const amount = z.string().regex(/^(0|[1-9]\d*)\.\d{2}$/);

const commonEvent = {
  eventId: uuid,
  schemaVersion: z.literal(1),
  occurredAt: z.iso.datetime(),
  aggregateType: z.literal("transaction"),
  aggregateId: uuid,
};

const bankingEventSchema = z
  .discriminatedUnion("eventType", [
    z
      .object({
        ...commonEvent,
        eventType: z.literal("banking.deposit.completed"),
        payload: z
          .object({
            transactionId: uuid,
            reference: uuid,
            customerId: uuid,
            accountId: uuid,
            amount,
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        ...commonEvent,
        eventType: z.literal("banking.withdrawal.completed"),
        payload: z
          .object({
            transactionId: uuid,
            reference: uuid,
            customerId: uuid,
            accountId: uuid,
            amount,
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        ...commonEvent,
        eventType: z.literal("banking.transfer.completed"),
        payload: z
          .object({
            transactionId: uuid,
            reference: uuid,
            senderCustomerId: uuid,
            receiverCustomerId: uuid,
            fromAccountId: uuid,
            toAccountId: uuid,
            amount,
          })
          .strict(),
      })
      .strict(),
  ])
  .superRefine((event, context) => {
    if (event.aggregateId !== event.payload.transactionId) {
      context.addIssue({
        code: "custom",
        message: "Aggregate ID must match the transaction ID",
        path: ["aggregateId"],
      });
    }
  });

export type BankingEvent = z.infer<typeof bankingEventSchema>;

export function parseBankingEvent(input: unknown): BankingEvent {
  return bankingEventSchema.parse(input);
}
