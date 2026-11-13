# Banking event delivery

## Contract

The Banking service writes event records in the same PostgreSQL transaction as
the ledger transaction. The current envelope uses `schemaVersion: 1` and these
event types:

| Event type | When emitted | Payload |
|---|---|---|
| `banking.deposit.completed` | A deposit commits | `transactionId`, `reference`, `customerId`, `accountId`, `amount` |
| `banking.withdrawal.completed` | A withdrawal commits | `transactionId`, `reference`, `customerId`, `accountId`, `amount` |
| `banking.transfer.completed` | A transfer commits | `transactionId`, `reference`, `senderCustomerId`, `receiverCustomerId`, `fromAccountId`, `toAccountId`, `amount` |

`eventId` is a stable UUID, `aggregateId` is the transaction UUID, and
`occurredAt` is an ISO-8601 timestamp. Amounts are decimal strings with exactly
two fraction digits. The envelope is validated before it is sent; unknown
properties are rejected.

The payload deliberately excludes account numbers, profile data, transfer
descriptions, credentials, tokens, and idempotency keys. Customer and account
UUIDs are still pseudonymous personal data: consumers must restrict access,
avoid copying event data into logs, and retain it only as long as needed.

## Delivery and consumer behavior

Delivery is at least once. The publisher claims rows with a database lease and
`FOR UPDATE SKIP LOCKED`, then sends each event to a standard SQS queue. A
crash after SQS accepts a message but before the database marks it `PUBLISHED`
can cause redelivery; consumers must deduplicate on `(consumerName, eventId)`.
The inbox insert and consumer side effects must use the same database
transaction. A handler failure rolls back the inbox insert so the event can be
retried.

Transient send failures use exponential backoff capped by
`OUTBOX_RETRY_MAX_MS`. Once `OUTBOX_MAX_ATTEMPTS` is reached, the outbox row
moves to `DEAD`. Invalid envelopes are also marked `DEAD` and are not sent.
The database outbox `DEAD` state is separate from the SQS dead-letter queue:
the latter handles messages that a downstream SQS consumer repeatedly fails
to process.

Review the stored event and the downstream consumer before redrive. Replay one
database-dead event with:

```powershell
$env:OUTBOX_REPLAY_CONFIRM = "true"
npm run outbox:replay -- <event-uuid> --confirm
```

Replay preserves `eventId`, resets the publisher attempt counter, and makes the
event eligible immediately. The confirmation environment variable and explicit
UUID/flag are required to reduce accidental redrive. Consumer inbox records
must remain available across replay to prevent duplicate logical effects.

## Infrastructure and local development

`terraform/outbox` provisions an encrypted standard SQS queue, an encrypted
DLQ, a redrive policy, and a publisher IAM policy limited to `sqs:SendMessage`
on the standard queue. Attach the policy to the Banking workload role; do not
put AWS access keys in application configuration.

Initialize and plan the module with environment-specific values (do not commit
real `.tfvars` files):

```powershell
terraform -chdir=terraform/outbox init
terraform -chdir=terraform/outbox plan `
  -var="aws_region=us-east-1" `
  -var="queue_name=banking-events-dev"
```

After investigating and correcting the downstream consumer, an operator with
separate SQS redrive permissions can return messages from the SQS DLQ to the
source queue:

```powershell
aws sqs start-message-move-task `
  --source-arn <dead-letter-queue-arn> `
  --destination-arn <banking-events-queue-arn>
```

The database replay command above applies only to rows in outbox `DEAD` state;
SQS DLQ redrive applies only to messages rejected by a downstream SQS consumer.
Neither replay path changes `eventId`, so inbox deduplication remains necessary.

The publisher is disabled by default. Local development and tests require no
AWS account or queue. Enable it only when `OUTBOX_SQS_QUEUE_URL` is configured
and the process has AWS SDK credentials through the normal workload credential
chain. The `OUTBOX_*` polling, lease, retry, and batch settings have safe
defaults in `src/config/env.ts`.
