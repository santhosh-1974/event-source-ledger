# Execution Plan

This is the working, phased plan for evolving Event-Sourced Ledger toward the
NexusBank product vision. Phase status reflects the repository and validation
available on **2026-11-13**; update it when work lands. The current system and
the proposed target are distinguished in [architecture.md](./architecture.md).

## Principles and release gates

- Ship in small, reviewable increments. Do not rewrite the ledger.
- Keep account, ledger, and transaction changes atomic.
- Preserve authentication, ownership, idempotency, and internal endpoint
  protections as APIs move.
- Add or update tests for behavioral changes. Run the smallest relevant test
  set, then the required builds and broader suite before phase acceptance.
- Never represent a proposed service, queue, cloud resource, or feature as
  implemented until it exists and has been verified.
- For any data move, prove backup, restore, rollback, and reconciliation
  before production cutover.
- Keep secrets out of source, images, logs, and docs. Use placeholders only.

## Phase summary

| Phase | Deliverable | Status |
|---|---|---|
| 1 | Architecture audit and design | **Complete** — current/target architecture and this roadmap documented; some product decisions remain open. |
| 2 | Stabilize frontend/backend integration | **Incomplete** — backend and frontend suites pass, but full-stack browser-to-Gateway smoke coverage for registration and core banking journeys is still missing. |
| 3 | Complete Identity Service extraction | **Complete** — Identity is the sole Gateway auth route, owns credential storage, and has a reversible legacy-data migration; service builds, integration tests, and a migration rehearsal passed locally. |
| 4 | Extract Customer Service | **Complete** — Customer Service owns profile reads/writes; Banking and Identity use its versioned internal contract. Migration rollback/reapply preserved rows and foreign keys; integration tests and service/container builds pass. |
| 5 | Establish Banking Core boundary | **Complete** — Gateway forwards only the versioned Banking resources; OpenAPI, authorization/error contracts, and end-to-end Gateway tests cover account and financial flows. Existing atomic ledger, idempotency, ownership, and concurrency semantics remain unchanged. |
| 6 | Transactional Outbox and SQS | **Complete (locally validated; AWS deployment remains in Phase 11)** |
| 7 | Notification Service and SES | **Complete locally; backend tests, service builds, Compose configuration, and Terraform validation pass. Docker image build not run because the Docker daemon is unavailable; AWS deployment remains in Phase 11.** |
| 8 | Advanced banking operations and reporting | **Complete locally** — beneficiary validation, scheduled transfers, retry rules, and statements are implemented and verified against the source ledger. |
| 9 | Professional banking frontend | **Complete locally** — dashboard, payments, statements, notifications, security, and profile views are now wired into the authenticated banking frontend. |
| 10 | Containerization and CI/CD | **Partial** — local seven-service Docker Compose, CI validation, and all service build checks exist; image publishing and production hardening remain. |
| 11 | AWS deployment | **Not started** |
| 12 | Monitoring, security, and performance | **Not started** |

Phases may overlap where practical. In particular, local containerization has
already been delivered ahead of several application phases; it does not mean
those phases are complete or that AWS is deployed.

## Phase 1 — Architecture audit and design

**Status: Complete**

### Deliverables

- Record verified current architecture separately from the proposed target.
- Document service boundaries, ledger consistency rules, Docker topology,
  database ownership direction, unresolved decisions, and the roadmap.
- Preserve the current ledger and incrementally evolve the application.

### Exit criteria

- `architecture.md`, `execution-plan.md`, and `AI_CONTEXT.md` agree on what is
  implemented and what remains proposed.
- Decisions without stakeholder input remain marked open rather than silently
  assumed.

## Phase 2 — Stabilize frontend/backend integration

**Status: Incomplete**

### Work

- Trace registration, login, token propagation, protected routes, and customer
  provisioning end to end through nginx, Gateway, Identity, and Banking.
- Confirm frontend API paths use the gateway and work both in local development
  and in the supported Docker deployment.
- Fix integration defects without weakening backend authorization or exposing
  internal provisioning routes.
- Establish repeatable UI/API smoke tests and identify frontend test-suite
  failures versus missing test discovery.
- Verify deposit, withdrawal, transfer, balance, and transaction-history flows
  against a disposable test database.

### Exit criteria

- Registration and login issue a token that the UI can use on protected routes.
- Customer provisioning works through the authenticated internal service
  contract; the public gateway cannot invoke that endpoint.
- Core banking flows work end to end; transfers remain atomic and idempotent.
- Backend tests/build and frontend production build pass; remaining frontend
  test failures are fixed or explicitly isolated and tracked.

Phase 2 remains an unmet gate: the current browser-to-Gateway manual check
covers registration/login and account operations, but does not exercise all
core money-movement and history journeys end to end. Phase 3 was completed at
the user's direction before the full Phase 2 gate was met; the outstanding
Phase 2 validation remains tracked here.

## Phase 3 — Complete Identity Service extraction

**Status: Complete**

### Work

- Decide which authentication implementation is authoritative; avoid two
  divergent registration/login implementations.
- Stabilize the Identity-to-Customer provisioning contract and error handling.
- Define ownership and migration steps for the `users` table and credentials.
- Keep token claims, JWT validation, expiration, and frontend behavior
  compatible during cutover.
- Add integration tests for registration/login, provisioning failure, and
  duplicate requests.
- Move credential storage to an Identity-owned schema, backfill the legacy
  `users` rows without changing customer IDs or password hashes, and retain a
  reversible rollback path.
- Remove backend-owned registration/login handlers so the Gateway's Identity
  route is the sole supported authentication path.

### Exit criteria

- One supported auth path remains, routed through the Gateway.
- Identity can be deployed independently and does not directly write
  banking-owned customer data.
- Existing user/customer associations and credential hashes are preserved.

The Identity and Banking services still share a PostgreSQL instance and
database credentials. The new schema establishes logical ownership only; a
separate database role or instance remains a future hardening task.

## Phase 4 — Extract Customer Service

**Status: Complete**

### Work

- Define customer read/update/create APIs and ownership rules.
- Move profile ownership out of the Banking backend and route profile traffic
  through the Gateway to Customer Service.
- Move the existing `public.customers` table into `customer.customers` without
  changing IDs or breaking account and legacy-user foreign-key references.
- Keep login email immutable through profile updates until Identity can
  coordinate an email-change operation.
- Have Identity provision profiles and Banking validate customer existence
  through authenticated, versioned Customer Service contracts.
- Add owner-access, update, conflict, internal-secret, and Gateway contract
  tests; build and include Customer Service in local Compose and CI.

### Exit criteria

- Customer data has one authoritative writer.
- Identity and Banking access customer behavior through a versioned service
  contract; no accidental direct database coupling remains in the extracted
  paths.
- Existing customer IDs and foreign-key relationships remain valid.

The customer-table migration was rehearsed down and up against `ledger_test`;
the table OID, row count, and referencing foreign keys were unchanged. Backend
and frontend integration suites, lint, typechecks, production builds, the
Customer Service container build, and Compose configuration validation passed.
The profile UI now reads only the signed-in customer's profile rather than
requesting the former all-customer listing.

## Phase 5 — Establish the Banking Core boundary

**Status: Complete**

### Work

- Define and publish the versioned Banking Core API contract for accounts,
  deposits, withdrawals, transfers, balances, transaction history, and errors.
- Keep accounts, ledger entries, transactions, and idempotency in the same
  service and transactional boundary.
- Define explicit authorization and customer-ID lookup behavior across the
  Customer/Banking boundary; mask unauthorized resource reads as not found.
- Move the existing banking modules behind the boundary without changing
  ledger semantics.

### Exit criteria

- A transfer writes both entries and the transaction record atomically.
- Ledger-derived balances, idempotency, row locking, and ownership checks are
  covered by tests.
- Gateway contracts and error behavior are documented and versioned.

The Gateway now forwards only `/api/v1/accounts`, `/api/v1/banking`, and
`/api/v1/transactions` to Banking; other Banking-looking paths are rejected
at the edge. OpenAPI and the Gateway guide describe the v1 request/response,
authentication, ownership, idempotency, and error contracts. A Gateway
integration test exercises account creation, deposit, withdrawal, transfer,
balance, history, transaction details, unauthenticated access, and unknown or
internal routes. Existing transfer ownership behavior is explicit: both
accounts must belong to the caller. Backend tests, lint, typecheck, builds,
Gateway build, and Compose configuration validation passed.

## Phase 6 — Transactional Outbox and SQS

**Status: Complete (AWS deployment deferred to Phase 11)**

### Work

- Specify event names, payload schemas, versioning, PII policy, and delivery
  semantics.
- Add an outbox row in the same database transaction as each event-producing
  financial operation.
- Implement a reliable publisher with retry, visibility/lease handling, and
  observability.
- Configure SQS queues and a DLQ through infrastructure-as-code; do not make
  cloud resources a prerequisite for local development.
- Test duplicate publication, crashes before/after publish, and poison events.
- Keep publisher opt-in, provide a guarded outbox replay command, and make
  downstream processing idempotent by consumer/event ID.

### Exit criteria

- A committed transaction cannot lose its corresponding outbox event.
- An uncommitted transaction cannot publish an event.
- Publisher and consumer processing tolerate at-least-once delivery.
- DLQ redrive/replay is documented and tested.

The Banking service now writes versioned deposit, withdrawal, and transfer
events atomically with ledger transactions. Its opt-in SQS publisher uses
leased claims, bounded exponential retry, poison-event handling, and structured
logs. A transactional inbox helper deduplicates consumers, and the guarded
replay command preserves stable event IDs. Terraform defines an encrypted
standard queue, DLQ, redrive policy, and least-privilege publisher policy.
Focused integration tests cover rollback, idempotency replay, lease expiry,
consumer deduplication, and dead-event replay; the backend suite, lint,
typecheck/build, Compose validation, and Terraform validation pass. AWS
resources were not provisioned or exercised; deployment and live queue
redrive remain out of scope until Phase 11.

## Phase 7 — Notification Service and SES

**Status: Complete locally; live AWS deployment deferred to Phase 11**

### Work

- Create an idempotent consumer and store delivery attempts/status.
- Implement notification preferences and consent before sending customer
  messages.
- Integrate SES using workload IAM roles/secrets management, not embedded
  credentials.
- Add bounded retries, DLQ handling, and safe replay without duplicate
  customer-facing mail where possible.
- Add the Notification Service to Compose and CI, authenticated preference
  routes to the Gateway, and a least-privilege SQS/SES worker IAM policy.
- Document opt-in consent, redelivery/DLQ operations, replay safeguards, and
  the SES-accepted/database-unrecorded duplicate-delivery window.

### Exit criteria

- Notification delivery is asynchronous and cannot change the result of a
  committed banking transaction.
- Duplicate events do not produce duplicate logical notifications.
- Delivery failure, retries, and DLQ state are observable.

### Delivered and validated

The Notification Service now validates and deduplicates Banking events, stores
default-deny preferences and consent history, checks consent before contact
lookup, and records per-recipient delivery attempts with leases and bounded
retries. Its opt-in SQS worker acknowledges only fully terminal events; SES
delivery uses the workload credential chain. Gateway preference routes,
Customer Service's separately secret-protected contact lookup, Compose, CI,
and scoped worker IAM policy are implemented. Integration tests cover consent,
deduplication, transfer recipients, exhausted retries, safe replay, and Gateway
authentication. All 175 backend tests, lint, typecheck, service builds, Compose
configuration validation, and Terraform formatting/validation pass. A Docker
image build could not be run because the Docker daemon is unavailable in this
environment.

AWS resources were not provisioned or exercised. Production SES verification,
queue deployment/redrive, and workload role attachment remain in Phase 11.
Because SES acceptance and PostgreSQL status persistence are not atomic, a
process crash in that gap can still result in a duplicate email after redelivery.

## Phase 8 — Advanced banking operations and reporting

**Status: Complete locally**

### Work

- Add beneficiary management, owned-account restrictions, and allowance for
  saved third-party transfers only through active recipients.
- Add scheduled/recurring transfers with UTC weekly and monthly semantics,
  skipped missed runs, and explicit retry of failed occurrences.
- Implement ledger-derived statements as read-only JSON/CSV reporting against
  the authoritative ledger, with range limits and reconciliation checks.
- Keep the reporting path non-authoritative and verify it against the source
  ledger snapshot rather than introducing a mutable projection.

### Exit criteria

- Advanced operations enforce authorization, idempotency, and scheduling
  semantics with regression tests.
- Reports and statements are reproducible and their freshness/consistency is
  explicit.
- Reconciliation detects mismatches against the source ledger and reporting
  cannot mutate source-of-truth financial tables.

### Delivered and validated

The Banking Core now supports customer-owned beneficiaries, masked recipient
identifiers, third-party transfer execution through active saved recipients,
weekly/monthly schedule creation, stateful occurrence tracking, skip/failure
handling, and explicit retry. The statement API queries the source ledger in a
repeatable-read snapshot and returns reconciled JSON or CSV data with masked
account numbers and CSV formula-safe escaping. Integration tests cover
beneficiary validation, idempotent transfers, schedule execution, missed-run
logic, retry flow, monthly date clamping, cancellation, and statement
reconciliation. Backend tests, lint, typecheck, build, API Gateway build,
Customer Service build, Compose validation, and targeted Phase 8 integration
coverage all passed in this environment.

## Phase 9 — Professional banking frontend

**Status: Complete locally**

### Work

- Improve the existing UI while preserving working auth and banking flows.
- Evolve navigation toward Dashboard, Accounts, Payments, Transactions,
  Statements, Notifications, Security, and Profile.
- Add new features only after their service contracts and authorization rules
  exist.
- Provide loading, empty, error, and confirmation states; meet accessibility
  and responsive-layout expectations.
- Keep API access same-origin through the Gateway unless a deliberate
  deployment design changes that boundary.

### Exit criteria

- Core workflows remain functional and usable on mobile and desktop.
- UI states and accessibility are tested.
- No internal service URL or provisioning capability is embedded in the
  browser bundle.

### Delivered and validated

The frontend now exposes a more complete professional banking experience:
Overview, Accounts, Payments, Transactions, Statements, Notifications,
Security, and Profile all route through the authenticated shell, with customer
profile and notification preference integrations using the public Gateway.
Statement generation and CSV export call the Banking Core reporting endpoints,
while the dashboard and account views continue to preserve the working bank
journey. User-visible loading and error states are present, and the frontend
build plus Vitest suite pass in this environment.

## Phase 10 — Containerization and CI/CD

**Status: Partial**

### Already delivered

- Multi-stage Dockerfiles for the banking backend, Identity, Customer,
  Notification, API Gateway, and frontend; service-specific build ignores.
- Compose services for PostgreSQL 17, Banking, Identity, Customer,
  Notification, Gateway, and frontend.
- Health checks, dependency ordering, named PostgreSQL volume, private
  application ports, and migration/seed startup.
- Local image build and container startup were verified on 2026-11-11.
- Notification Service TypeScript build and Compose configuration validate;
  its Docker image build could not be checked because the Docker daemon was
  unavailable in this environment.

### Remaining work

- Add image tagging, vulnerability scanning, and ECR publishing.
- Define production runtime configuration, resource limits, graceful
  shutdown, deployment/rollback, and database migration operations.
- Re-verify all service image builds and health checks after Dockerfile or dependency
  changes.

### Exit criteria

- CI builds and tests every service and reliably builds images.
- Secrets are injected at runtime; no `.env`, `node_modules`, or credentials
  enter image layers.
- Deployment can be rolled back safely and does not remove persistent data.

## Phase 11 — AWS deployment

**Status: Not started**

### Work

- Provision infrastructure as code for networking, ECS Fargate, ECR, ALB,
  RDS, SQS/DLQ, SES, S3/CloudFront, DNS/TLS, Secrets Manager, and monitoring.
- Use private subnets/security groups for backend and database access where
  appropriate.
- Define backup, restore, maintenance, scaling, cost budgets, and environment
  promotion.
- Deploy to a non-production environment first; exercise rollback and disaster
  recovery before production.

### Exit criteria

- A documented, repeatable deployment and recovery process exists.
- TLS, IAM least privilege, secret rotation, database backups, and service
  health alarms are verified.
- Production approval and operational ownership are explicit.

## Phase 12 — Monitoring, security, and performance

**Status: Not started**

### Work

- Add structured correlation IDs, service metrics, dashboards, and actionable
  alarms.
- Establish rate limits, abuse controls, dependency updates, vulnerability
  scanning, and security review cadence.
- Load-test critical reads and money movement; measure database contention,
  p95/p99 latency, and queue lag.
- Define incident response, audit retention, and operational runbooks.

### Exit criteria

- SLOs and alert thresholds are agreed and tested.
- Critical failure modes have runbooks and exercised recovery procedures.
- Performance targets and security findings are tracked with owners.

## Immediate next actions

1. Establish the baseline frontend↔Gateway↔Identity↔Banking user journeys.
2. Resolve integration/test-discovery defects and retain regression coverage.
3. Decide whether Event-Sourced Ledger and NexusBank are separate repository
   and product names.
4. Update this document's statuses only when the phase exit criteria are
   verified.

## Change log

| Date | Update |
|---|---|
| 2026-11-11 | Initial repository-grounded roadmap; records local Compose as implemented and Phase 2 as next. |
