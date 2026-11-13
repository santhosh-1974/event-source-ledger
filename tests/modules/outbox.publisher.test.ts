import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  claimOutboxEvents,
  markOutboxEventDead,
  markOutboxEventPublished,
  recordOutboxPublishFailure,
} from "../../src/modules/outbox/outbox.repository";
import { publishOutboxBatch } from "../../src/modules/outbox/outbox.publisher";
import { EventPublisher } from "../../src/modules/outbox/sqs-event-publisher";

vi.mock("../../src/modules/outbox/outbox.repository", () => ({
  claimOutboxEvents: vi.fn(),
  markOutboxEventDead: vi.fn(),
  markOutboxEventPublished: vi.fn(),
  recordOutboxPublishFailure: vi.fn(),
}));

const event = {
  eventId: "7b9d1c28-9c2a-4a2c-8e95-781c56c30320",
  eventType: "banking.deposit.completed",
  schemaVersion: 1,
  occurredAt: "2026-01-01T00:00:00.000Z",
  aggregateType: "transaction",
  aggregateId: "d3d8f3bd-6a58-48af-a3c1-5a8eebc10f2d",
  payload: {
    transactionId: "d3d8f3bd-6a58-48af-a3c1-5a8eebc10f2d",
    reference: "d32f2253-f06c-4c0f-b29a-1f0059153d46",
    customerId: "b401a7e6-77d4-4690-8992-28c1d47c9257",
    accountId: "218e1671-5de0-4546-8470-dc0d075e1933",
    amount: "12.00",
  },
};

const options = {
  batchSize: 10,
  leaseMs: 60_000,
  maxAttempts: 8,
  retryBaseMs: 1_000,
  retryMaxMs: 10_000,
};

const record = {
  id: event.eventId,
  event,
  attemptCount: 2,
  lockToken: "lock-token",
};

const publisher: EventPublisher = {
  publish: vi.fn(),
};

const mockClaim = vi.mocked(claimOutboxEvents);
const mockMarkDead = vi.mocked(markOutboxEventDead);
const mockMarkPublished = vi.mocked(markOutboxEventPublished);
const mockRecordFailure = vi.mocked(recordOutboxPublishFailure);

beforeEach(() => {
  vi.clearAllMocks();
  mockClaim.mockResolvedValue([record]);
  mockMarkDead.mockResolvedValue(true);
  mockMarkPublished.mockResolvedValue(true);
  mockRecordFailure.mockResolvedValue("PENDING");
});

describe("publishOutboxBatch", () => {
  it("publishes the stable event and records the acknowledgement", async () => {
    vi.mocked(publisher.publish).mockResolvedValue("sqs-message-id");

    const result = await publishOutboxBatch(publisher, options);

    expect(result).toEqual({ claimed: 1, published: 1, retried: 0, dead: 0 });
    expect(publisher.publish).toHaveBeenCalledWith(event);
    expect(mockMarkPublished).toHaveBeenCalledWith(
      event.eventId,
      record.lockToken,
      "sqs-message-id"
    );
  });

  it("records a transient failure with bounded exponential backoff", async () => {
    vi.mocked(publisher.publish).mockRejectedValue(new Error("SQS unavailable"));

    const result = await publishOutboxBatch(publisher, options);

    expect(result.retried).toBe(1);
    expect(mockRecordFailure).toHaveBeenCalledWith(
      event.eventId,
      record.lockToken,
      "SQS unavailable",
      2_000,
      options.maxAttempts
    );
  });

  it("moves an invalid event to DEAD without sending it", async () => {
    mockClaim.mockResolvedValue([{ ...record, event: { ...event, extra: true } }]);

    const result = await publishOutboxBatch(publisher, options);

    expect(result.dead).toBe(1);
    expect(publisher.publish).not.toHaveBeenCalled();
    expect(mockMarkDead).toHaveBeenCalledWith(
      event.eventId,
      record.lockToken,
      expect.stringContaining("root")
    );
  });

  it("reports an event dead after it exhausts its configured attempts", async () => {
    vi.mocked(publisher.publish).mockRejectedValue(new Error("SQS unavailable"));
    mockRecordFailure.mockResolvedValue("DEAD");

    const result = await publishOutboxBatch(publisher, options);

    expect(result.dead).toBe(1);
    expect(result.retried).toBe(0);
  });

  it("preserves the event ID when SQS succeeds but the database lease is lost", async () => {
    vi.mocked(publisher.publish).mockResolvedValue("sqs-message-id");
    mockMarkPublished.mockResolvedValue(false);

    const result = await publishOutboxBatch(publisher, options);

    expect(result.published).toBe(0);
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: event.eventId })
    );
    expect(mockMarkPublished).toHaveBeenCalledWith(
      event.eventId,
      record.lockToken,
      "sqs-message-id"
    );
  });
});
