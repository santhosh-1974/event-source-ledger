# Execution Plan

This is the working, phased plan for evolving Event-Sourced Ledger toward the
NexusBank product vision. Phase status reflects the repository and validation
available on **2026-11-11**; update it when work lands. The current system and
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
| 2 | Stabilize frontend/backend integration | **Next** |
| 3 | Complete Identity Service extraction | **Partial** — a separate service and gateway route exist; auth also remains in the banking backend and data is shared. |
| 4 | Extract Customer Service | **Not started** |
| 5 | Establish Banking Core boundary | **Not started** — the current banking backend already contains this domain; extraction and contract hardening remain. |
| 6 | Transactional Outbox and SQS | **Not started** |
| 7 | Notification Service and SES | **Not started** |
| 8 | Advanced banking operations and reporting | **Not started** |
| 9 | Professional banking frontend | **In progress / partial** — current banking UI exists; planned navigation and capabilities remain incomplete. |
| 10 | Containerization and CI/CD | **Partial** — local five-service Docker Compose is implemented and was built/started with healthy checks; CI, registry publishing, and production hardening remain. |
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

**Status: Next**

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

## Phase 3 — Complete Identity Service extraction

**Status: Partial**

### Work

- Decide which authentication implementation is authoritative; avoid two
  divergent registration/login implementations.
- Stabilize the Identity-to-Customer provisioning contract and error handling.
- Define ownership and migration steps for the `users` table and credentials.
- Keep token claims, JWT validation, expiration, and frontend behavior
  compatible during cutover.
- Add integration tests for registration/login, provisioning failure, and
  duplicate requests.

### Exit criteria

- One supported auth path remains, routed through the Gateway.
- Identity can be deployed independently and does not directly write
  banking-owned customer data.
- Existing user/customer associations and credential hashes are preserved.

## Phase 4 — Extract Customer Service

**Status: Not started**

### Work

- Define customer read/update/create APIs and ownership rules.
- Move profile ownership from the banking backend only after Identity and
  Banking use the customer contract rather than direct table access.
- Define an incremental migration for existing `customers` rows and
  references from accounts and users.
- Update Gateway routes and contract tests.

### Exit criteria

- Customer data has one authoritative writer.
- Identity and Banking access customer behavior through a versioned service
  contract; no accidental direct database coupling remains in the extracted
  paths.
- Existing customer IDs and foreign-key relationships remain valid.

## Phase 5 — Establish the Banking Core boundary

**Status: Not started**

### Work

- Define Banking Core API contracts for accounts, deposits, withdrawals,
  transfers, balances, and transaction history.
- Keep accounts, ledger entries, transactions, and idempotency in the same
  service and transactional boundary.
- Define explicit authorization and customer-ID lookup behavior across the
  Customer/Banking boundary.
- Move the existing banking modules behind the boundary without changing
  ledger semantics.

### Exit criteria

- A transfer writes both entries and the transaction record atomically.
- Ledger-derived balances, idempotency, row locking, and ownership checks are
  covered by tests.
- Gateway contracts and error behavior are documented and versioned.

## Phase 6 — Transactional Outbox and SQS

**Status: Not started**

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

### Exit criteria

- A committed transaction cannot lose its corresponding outbox event.
- An uncommitted transaction cannot publish an event.
- Publisher and consumer processing tolerate at-least-once delivery.
- DLQ redrive/replay is documented and tested.

## Phase 7 — Notification Service and SES

**Status: Not started**

### Work

- Create an idempotent consumer and store delivery attempts/status.
- Implement notification preferences and consent before sending customer
  messages.
- Integrate SES using workload IAM roles/secrets management, not embedded
  credentials.
- Add bounded retries, DLQ handling, and safe replay without duplicate
  customer-facing mail where possible.

### Exit criteria

- Notification delivery is asynchronous and cannot change the result of a
  committed banking transaction.
- Duplicate events do not produce duplicate logical notifications.
- Delivery failure, retries, and DLQ state are observable.

## Phase 8 — Advanced banking operations and reporting

**Status: Not started**

### Work

- Prioritize advanced banking operations such as beneficiary management,
  scheduled/recurring transfers, and robust failure/status handling.
- Define statement, filtering, and reporting requirements, including data
  retention and freshness expectations.
- Build read models from ledger/outbox events or a documented read-only
  projection process when query needs justify them.
- Keep reporting projections non-authoritative; verify them against the source
  ledger.

### Exit criteria

- Advanced operations enforce authorization, idempotency, and scheduling
  semantics with regression tests.
- Reports and statements are reproducible and their freshness/consistency is
  explicit.
- Reconciliation detects missing, duplicated, or inconsistent projection data;
  reporting cannot mutate financial source-of-truth tables.

## Phase 9 — Professional banking frontend

**Status: In progress / partial**

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

## Phase 10 — Containerization and CI/CD

**Status: Partial**

### Already delivered

- Multi-stage Dockerfiles for the banking backend, Identity Service, API
  Gateway, and frontend; service-specific build ignores.
- Compose services for PostgreSQL 17, Banking, Identity, Gateway, and frontend.
- Health checks, dependency ordering, named PostgreSQL volume, private
  application ports, and migration/seed startup.
- Local image build and container startup were verified on 2026-11-11.

### Remaining work

- Add CI validation for builds, tests, Compose config, and image builds.
- Add image tagging, vulnerability scanning, and ECR publishing.
- Define production runtime configuration, resource limits, graceful
  shutdown, deployment/rollback, and database migration operations.
- Re-verify all five builds and health checks after Dockerfile or dependency
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
