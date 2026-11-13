# Phase 8: Beneficiaries, Scheduled Transfers, and Statements

Phase 8 keeps money movement and reporting in the Banking Core. Beneficiaries,
schedules, occurrences, ledger entries, transactions, and their outbox events
share the same PostgreSQL transaction boundaries. The Gateway forwards only
the documented Phase 8 routes; all are authenticated and customer-scoped.

## Beneficiaries and third-party transfers

`POST /api/v1/beneficiaries` accepts an account number and display name. It
only saves an existing, active account owned by another customer. The API
returns a masked account number. Duplicate recipients are rejected; a saved
beneficiary can be disabled or re-enabled with
`PATCH /api/v1/beneficiaries/:beneficiaryId` and `{ "enabled": false }`.
Disabling a beneficiary prevents new and scheduled transfers through it.
Schedules re-check the beneficiary and both account statuses at execution.

Existing `POST /api/v1/banking/transfer` behavior is unchanged: both accounts
must belong to the caller. A third-party transfer must instead use
`POST /api/v1/banking/beneficiary-transfers` with the caller's source account
and an active beneficiary ID. It requires a UUID `Idempotency-Key`; the four
balanced ledger entries, transaction, outbox event, and idempotency response
commit atomically.

## Scheduled and recurring transfers

Create a schedule with `POST /api/v1/scheduled-transfers` and an
`Idempotency-Key`. The caller must own an active source account and an active
saved beneficiary. `frequency` is `ONCE`, `WEEKLY`, or `MONTHLY`; `startsAt`
must include an explicit UTC offset. Weekly schedules repeat every seven days.
Monthly schedules retain the original UTC time and day; if that day does not
exist in a month, the occurrence uses that month's last day.

The Banking process runs a database-backed worker every 30 seconds by default.
`SCHEDULED_TRANSFER_WORKER_ENABLED`, `SCHEDULED_TRANSFER_POLL_INTERVAL_MS`,
`SCHEDULED_TRANSFER_BATCH_SIZE`, and
`SCHEDULED_TRANSFER_MISFIRE_GRACE_SECONDS` configure it. The default grace
period is five minutes: a due occurrence inside the grace period can execute;
an occurrence later than that is recorded as `SKIPPED` and never caught up.
The next recurrence advances from its scheduled time, not from processing
time. Account status, beneficiary status, and available balance are checked
again at execution.

Each occurrence is executed in the same transaction that writes its ledger
entries, transaction, and outbox event. A unique `(schedule_id, scheduled_for)`
key plus row locking prevents duplicate execution across concurrent workers.
An insufficient balance records `FAILED`; no automatic retry is attempted.
The occurrence can be retried explicitly at
`POST /api/v1/scheduled-transfers/:scheduleId/occurrences/:occurrenceId/retry`
with a new `Idempotency-Key`. Failed recurring occurrences do not block later
occurrences. Schedules can be paused, resumed, or cancelled with
`POST /api/v1/scheduled-transfers/:scheduleId/{pause|resume|cancel}`. A resumed
overdue schedule follows the same grace-period rule.

`GET /api/v1/scheduled-transfers` lists the caller's schedules; each schedule's
`GET /api/v1/scheduled-transfers/:scheduleId/occurrences` lists up to its 500
most recent results. The occurrence history keeps success transaction IDs,
failure codes, and skipped times for review.

## Statements and reporting

`GET /api/v1/reports/statements/:accountNumber?from=YYYY-MM-DD&to=YYYY-MM-DD`
returns JSON; add `format=csv` for a downloadable CSV. Dates are inclusive UTC
calendar dates. The range is limited to 366 days and a report to 5,000 ledger
entries; requests beyond either limit fail rather than returning a partial
statement.

Statements query the authoritative ledger directly in a read-only,
repeatable-read database snapshot. They include the snapshot timestamp,
opening and closing balances, debit/credit totals, and an ordered running
balance for each entry. The application verifies that the opening balance plus
the statement entries reconciles to the closing ledger balance before
returning a report. CSV text is quoted and formula-like descriptions are
escaped. Account numbers are masked in both formats.

No separate projection is used: statement freshness is the ledger snapshot
timestamp, and no new retention or deletion policy is applied to source ledger
data. The ledger remains the source of truth; reports cannot mutate financial
records.
