# Notification Service

The Notification Service consumes banking events from the Phase 6 SQS queue.
It is a separate process: notification failures never affect the result of a
committed banking transaction. The worker and SES integration are disabled by
default in local Compose.

## Consent and API

The Gateway exposes two authenticated, customer-scoped endpoints:

| Method | Path | Behavior |
|---|---|---|
| `GET` | `/api/v1/notifications/preferences` | Returns the caller's email preference; a customer with no saved preference is opted out. |
| `PUT` | `/api/v1/notifications/preferences` | Sets email consent with `{ "emailEnabled": true, "consent": true }`; opt out with `{ "emailEnabled": false }`. |

Enabling email without explicit consent is rejected. Preference changes and
consent-history records are committed together. Revoking consent prevents
subsequent sends; it does not recall an email already accepted by SES. Events
skipped for lack of consent are terminal, so opting in later applies to future
events only.

The worker checks current consent before requesting an email address. It then
uses the Customer Service's internal contact lookup, which requires the
separate `NOTIFICATION_CUSTOMER_LOOKUP_SECRET`; the Gateway blocks this route.
Email addresses are not copied into notification delivery records.

## Processing and delivery

The service validates the versioned Banking event envelope and keeps an
idempotent event record. Deposits and withdrawals create one recipient notice;
transfers create a notice for each participant. Delivery rows are unique per
event, customer, and channel. Successful and consent-skipped deliveries are
terminal, so normal SQS redelivery does not send them again.

Each SES attempt is persisted with a monotonic attempt number and a lease token.
Failed deliveries are retried up to `NOTIFICATION_MAX_ATTEMPTS` (default 5);
the worker acknowledges an SQS message only after all recipient deliveries are
`SENT` or `SKIPPED_CONSENT`. Otherwise, SQS redelivery applies and the Phase 6
queue redrive policy eventually moves a repeatedly failing message to its DLQ.
Keep the queue's `maxReceiveCount` and `NOTIFICATION_MAX_ATTEMPTS` aligned.

There is an unavoidable at-least-once edge: SES may accept an email immediately
before the worker crashes and before it records `SENT`. Redelivery can send that
email again. Persisted delivery state prevents duplicates in ordinary retries,
but SES does not provide an idempotency key that closes this provider/database
crash window.

## Configuration and AWS

Compose sets `NOTIFICATION_CONSUMER_ENABLED=false` and
`NOTIFICATION_SES_ENABLED=false` by default. To enable the worker, configure:

- `NOTIFICATION_CONSUMER_ENABLED=true`
- `NOTIFICATION_SQS_QUEUE_URL` to the same queue URL used by the Banking
  outbox publisher
- `NOTIFICATION_SES_ENABLED=true` and a verified
  `NOTIFICATION_SES_FROM_EMAIL`
- `NOTIFICATION_MAX_ATTEMPTS` to match the queue redrive policy
- `AWS_REGION` and the standard AWS workload credential chain

The Notification Service uses the AWS SDK credential chain; do not put AWS
access keys in environment files. The `terraform/notifications` module creates
a worker policy scoped to the supplied queue ARN and SES identity ARN. Attach it
to the worker's task role. It grants only SQS receive/delete and SES send
actions. The module does not provision AWS resources until explicitly applied.

## Failure replay

Inspect the notification event/delivery/attempt rows and the SQS DLQ before
replay. Use the guarded command from the Notification Service directory:

```bash
NOTIFICATION_REPLAY_CONFIRM=true npm run notification:replay -- <event-uuid> --confirm
```

The command resets only `FAILED` recipient deliveries for an unprocessed event;
`SENT` and `SKIPPED_CONSENT` rows remain terminal. After resetting, redrive the
corresponding message from the SQS DLQ using the Phase 6 queue operations.
Replay does not bypass consent, retry limits, or event validation.
