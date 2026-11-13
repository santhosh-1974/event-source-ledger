import { beforeEach, describe, expect, it } from "vitest";

import gatewayApp from "../../services/api-gateway/src/app";
import { processDueScheduledTransfers } from "../../src/modules/scheduled-transfers/scheduled-transfer.service";
import { authenticatedRequest, registerTestUser } from "../helpers/auth";
import { resetDatabase } from "../helpers/database";
import { query } from "../../src/database/database";

beforeEach(async () => {
  await resetDatabase();
});

async function createUser(
  name: string,
  email: string,
  phone: string,
  accountNumber: string
) {
  const user = await registerTestUser(gatewayApp, { name, email, phone });
  const response = await authenticatedRequest(gatewayApp, user.token)
    .post("/api/v1/accounts")
    .send({
      customerId: user.customer.id,
      accountNumber,
      accountType: "SAVINGS",
    });
  expect(response.status).toBe(201);
  return user;
}

async function deposit(
  token: string,
  accountNumber: string,
  amount: string
): Promise<void> {
  const response = await authenticatedRequest(gatewayApp, token)
    .post("/api/v1/banking/deposit")
    .set("Idempotency-Key", crypto.randomUUID())
    .send({ accountNumber, amount });
  expect(response.status).toBe(201);
}

async function saveBeneficiary(
  token: string,
  accountNumber: string
): Promise<{ id: string; accountNumberMasked: string }> {
  const response = await authenticatedRequest(gatewayApp, token)
    .post("/api/v1/beneficiaries")
    .send({ accountNumber, displayName: "Rent recipient" });
  expect(response.status).toBe(201);
  return response.body.data;
}

describe("Phase 8 advanced banking and reporting", () => {
  it("limits third-party transfers to saved beneficiaries and preserves transfer idempotency", async () => {
    const sender = await createUser(
      "Beneficiary Sender",
      "beneficiary-sender@example.com",
      "9876543301",
      "2100000001"
    );
    const recipient = await createUser(
      "Beneficiary Recipient",
      "beneficiary-recipient@example.com",
      "9876543302",
      "2100000002"
    );
    await deposit(sender.token, "2100000001", "100.00");
    const beneficiary = await saveBeneficiary(sender.token, "2100000002");

    expect(beneficiary.accountNumberMasked).toBe("****0002");

    const senderClient = authenticatedRequest(gatewayApp, sender.token);
    const ownAccount = await senderClient
      .post("/api/v1/beneficiaries")
      .send({ accountNumber: "2100000001", displayName: "Self" });
    const directTransfer = await senderClient
      .post("/api/v1/banking/transfer")
      .set("Idempotency-Key", crypto.randomUUID())
      .send({
        fromAccountNumber: "2100000001",
        toAccountNumber: "2100000002",
        amount: "10.00",
      });
    const duplicateBeneficiary = await senderClient
      .post("/api/v1/beneficiaries")
      .send({ accountNumber: "2100000002", displayName: "Duplicate" });

    expect(ownAccount.status).toBe(409);
    expect(directTransfer.status).toBe(404);
    expect(duplicateBeneficiary.status).toBe(409);

    const key = crypto.randomUUID();
    const body = {
      fromAccountNumber: "2100000001",
      beneficiaryId: beneficiary.id,
      amount: "25.00",
      description: "Monthly payment",
    };
    const first = await senderClient
      .post("/api/v1/banking/beneficiary-transfers")
      .set("Idempotency-Key", key)
      .send(body);
    const duplicate = await senderClient
      .post("/api/v1/banking/beneficiary-transfers")
      .set("Idempotency-Key", key)
      .send(body);

    expect(first.status).toBe(201);
    expect(duplicate.status).toBe(201);
    expect(duplicate.body.data.transactionId).toBe(
      first.body.data.transactionId
    );
    expect(
      (
        await senderClient.get("/api/v1/banking/2100000001/balance")
      ).body.data.balance
    ).toBe("75.00");
    expect(
      (
        await authenticatedRequest(gatewayApp, recipient.token).get(
          "/api/v1/banking/2100000002/balance"
        )
      ).body.data.balance
    ).toBe("25.00");

    const foreignUpdate = await authenticatedRequest(gatewayApp, recipient.token)
      .patch(`/api/v1/beneficiaries/${beneficiary.id}`)
      .send({ enabled: false });
    expect(foreignUpdate.status).toBe(404);

    await senderClient
      .patch(`/api/v1/beneficiaries/${beneficiary.id}`)
      .send({ enabled: false });
    const disabledTransfer = await senderClient
      .post("/api/v1/banking/beneficiary-transfers")
      .set("Idempotency-Key", crypto.randomUUID())
      .send(body);
    expect(disabledTransfer.status).toBe(409);
  });

  it("executes a recurring schedule once per occurrence and replays failed occurrences only explicitly", async () => {
    const sender = await createUser(
      "Schedule Sender",
      "schedule-sender@example.com",
      "9876543303",
      "2200000001"
    );
    const recipient = await createUser(
      "Schedule Recipient",
      "schedule-recipient@example.com",
      "9876543304",
      "2200000002"
    );
    const beneficiary = await saveBeneficiary(sender.token, "2200000002");
    await deposit(sender.token, "2200000001", "50.00");
    const startsAt = new Date(Date.now() + 60_000).toISOString();
    const scheduleBody = {
      fromAccountNumber: "2200000001",
      beneficiaryId: beneficiary.id,
      amount: "10.00",
      frequency: "WEEKLY",
      startsAt,
    };
    const createKey = crypto.randomUUID();
    const schedules = authenticatedRequest(gatewayApp, sender.token);
    const created = await schedules
      .post("/api/v1/scheduled-transfers")
      .set("Idempotency-Key", createKey)
      .send(scheduleBody);
    const duplicateCreate = await schedules
      .post("/api/v1/scheduled-transfers")
      .set("Idempotency-Key", createKey)
      .send(scheduleBody);

    expect(created.status).toBe(201);
    expect(duplicateCreate.body.data.id).toBe(created.body.data.id);
    expect(duplicateCreate.body.data.id).toBeDefined();
    const dueAt = new Date(new Date(startsAt).getTime() + 60_000);
    await expect(
      processDueScheduledTransfers(dueAt, { misfireGraceSeconds: 300 })
    ).resolves.toEqual({ succeeded: 1, failed: 0, skipped: 0 });
    await expect(
      processDueScheduledTransfers(dueAt, { misfireGraceSeconds: 300 })
    ).resolves.toEqual({ succeeded: 0, failed: 0, skipped: 0 });

    const occurrences = await schedules.get(
      `/api/v1/scheduled-transfers/${created.body.data.id}/occurrences`
    );
    expect(occurrences.status).toBe(200);
    expect(occurrences.body.data).toHaveLength(1);
    expect(occurrences.body.data[0].status).toBe("SUCCEEDED");
    expect(
      (
        await schedules.get("/api/v1/banking/2200000001/balance")
      ).body.data.balance
    ).toBe("40.00");
    expect(
      (
        await authenticatedRequest(gatewayApp, recipient.token).get(
          "/api/v1/banking/2200000002/balance"
        )
      ).body.data.balance
    ).toBe("10.00");

    const unpaidSender = await createUser(
      "Unfunded Schedule Sender",
      "schedule-unfunded@example.com",
      "9876543305",
      "2200000003"
    );
    const unpaidBeneficiary = await saveBeneficiary(
      unpaidSender.token,
      "2200000002"
    );
    const unpaidStartsAt = new Date(Date.now() + 60_000).toISOString();
    const oneTime = await authenticatedRequest(gatewayApp, unpaidSender.token)
      .post("/api/v1/scheduled-transfers")
      .set("Idempotency-Key", crypto.randomUUID())
      .send({
        fromAccountNumber: "2200000003",
        beneficiaryId: unpaidBeneficiary.id,
        amount: "5.00",
        frequency: "ONCE",
        startsAt: unpaidStartsAt,
      });
    expect(oneTime.status).toBe(201);
    const failedAt = new Date(new Date(unpaidStartsAt).getTime() + 60_000);
    await expect(
      processDueScheduledTransfers(failedAt, { misfireGraceSeconds: 300 })
    ).resolves.toMatchObject({ failed: 1 });
    const failedOccurrence = await query<{ id: string; status: string }>(
      `SELECT id, status
       FROM scheduled_transfer_occurrences
       WHERE schedule_id = $1`,
      [oneTime.body.data.id]
    );
    expect(failedOccurrence.rows[0].status).toBe("FAILED");

    await deposit(unpaidSender.token, "2200000003", "5.00");
    const retried = await authenticatedRequest(gatewayApp, unpaidSender.token)
      .post(
        `/api/v1/scheduled-transfers/${oneTime.body.data.id}/occurrences/${failedOccurrence.rows[0].id}/retry`
      )
      .set("Idempotency-Key", crypto.randomUUID())
      .send();
    expect(retried.status).toBe(200);
    expect(retried.body.data.status).toBe("SUCCEEDED");
    expect(
      (
        await authenticatedRequest(gatewayApp, unpaidSender.token).get(
          "/api/v1/banking/2200000003/balance"
        )
      ).body.data.balance
    ).toBe("0.00");
  });

  it("skips overdue occurrences, clamps monthly dates, and respects cancellation", async () => {
    const sender = await createUser(
      "Monthly Schedule Sender",
      "schedule-monthly@example.com",
      "9876543306",
      "2300000001"
    );
    await deposit(sender.token, "2300000001", "20.00");
    const recipient = await createUser(
      "Monthly Schedule Recipient",
      "schedule-monthly-recipient@example.com",
      "9876543307",
      "2300000002"
    );
    const beneficiary = await saveBeneficiary(sender.token, "2300000002");
    const nextYear = new Date().getUTCFullYear() + 1;
    const startsAt = new Date(Date.UTC(nextYear, 0, 31, 9)).toISOString();
    const februaryEnd = new Date(
      Date.UTC(nextYear, 2, 0, 9)
    ).toISOString();
    const schedules = authenticatedRequest(gatewayApp, sender.token);
    const monthly = await schedules
      .post("/api/v1/scheduled-transfers")
      .set("Idempotency-Key", crypto.randomUUID())
      .send({
        fromAccountNumber: "2300000001",
        beneficiaryId: beneficiary.id,
        amount: "2.00",
        frequency: "MONTHLY",
        startsAt,
      });
    expect(monthly.status).toBe(201);

    const firstDue = new Date(new Date(startsAt).getTime() + 60_000);
    await processDueScheduledTransfers(firstDue);
    const nextRun = await query<{ next_run_at: Date }>(
      "SELECT next_run_at FROM scheduled_transfers WHERE id = $1",
      [monthly.body.data.id]
    );
    expect(nextRun.rows[0].next_run_at.toISOString()).toBe(februaryEnd);

    const missedAt = new Date(
      new Date(februaryEnd).getTime() + 24 * 60 * 60 * 1000
    );
    const missed = await processDueScheduledTransfers(
      missedAt
    );
    expect(missed.skipped).toBe(1);
    const occurrence = await query<{ status: string; error_code: string }>(
      `SELECT status, error_code
       FROM scheduled_transfer_occurrences
       WHERE schedule_id = $1 AND scheduled_for = $2`,
      [monthly.body.data.id, februaryEnd]
    );
    expect(occurrence.rows[0]).toEqual({
      status: "SKIPPED",
      error_code: "MISSED_SCHEDULE",
    });

    const cancelStartsAt = new Date(
      Date.UTC(nextYear, 3, 1, 9)
    ).toISOString();
    const cancelable = await schedules
      .post("/api/v1/scheduled-transfers")
      .set("Idempotency-Key", crypto.randomUUID())
      .send({
        fromAccountNumber: "2300000001",
        beneficiaryId: beneficiary.id,
        amount: "3.00",
        frequency: "ONCE",
        startsAt: cancelStartsAt,
      });
    const canceled = await schedules.post(
      `/api/v1/scheduled-transfers/${cancelable.body.data.id}/cancel`
    );
    expect(canceled.body.data.status).toBe("CANCELLED");
    const noExecution = await processDueScheduledTransfers(
      new Date(new Date(cancelStartsAt).getTime() + 60_000)
    );
    expect(noExecution.succeeded).toBe(0);
    expect(
      (
        await authenticatedRequest(gatewayApp, recipient.token).get(
          "/api/v1/banking/2300000002/balance"
        )
      ).body.data.balance
    ).toBe("2.00");
  });

  it("returns ledger-reconciled JSON and formula-safe CSV statements", async () => {
    const sender = await createUser(
      "Statement Owner",
      "statement-owner@example.com",
      "9876543308",
      "2400000001"
    );
    const recipient = await createUser(
      "Statement Recipient",
      "statement-recipient@example.com",
      "9876543309",
      "2400000002"
    );
    await deposit(sender.token, "2400000001", "100.00");
    const beneficiary = await saveBeneficiary(sender.token, "2400000002");
    const transfer = await authenticatedRequest(gatewayApp, sender.token)
      .post("/api/v1/banking/beneficiary-transfers")
      .set("Idempotency-Key", crypto.randomUUID())
      .send({
        fromAccountNumber: "2400000001",
        beneficiaryId: beneficiary.id,
        amount: "10.00",
        description: '=HYPERLINK("https://example.invalid")',
      });
    expect(transfer.status).toBe(201);

    const today = new Date().toISOString().slice(0, 10);
    const client = authenticatedRequest(gatewayApp, sender.token);
    const statement = await client.get(
      `/api/v1/reports/statements/2400000001?from=${today}&to=${today}`
    );
    expect(statement.status).toBe(200);
    expect(statement.body.data).toMatchObject({
      accountNumberMasked: "****0001",
      openingBalance: "0.00",
      totalDebits: "10.00",
      totalCredits: "100.00",
      closingBalance: "90.00",
    });
    expect(
      statement.body.data.entries.map(
        (entry: { runningBalance: string }) => entry.runningBalance
      )
    ).toEqual(["100.00", "90.00"]);

    const csv = await client.get(
      `/api/v1/reports/statements/2400000001?from=${today}&to=${today}&format=csv`
    );
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.text).toContain(`"'=HYPERLINK(""https://example.invalid"")"`);

    const foreignStatement = await authenticatedRequest(
      gatewayApp,
      recipient.token
    ).get(
      `/api/v1/reports/statements/2400000001?from=${today}&to=${today}`
    );
    const tooWide = await client.get(
      "/api/v1/reports/statements/2400000001?from=2020-01-01&to=2022-01-01"
    );
    expect(foreignStatement.status).toBe(404);
    expect(tooWide.status).toBe(400);
  });
});
