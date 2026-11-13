# AI Agent Project Context

Read this file first when beginning work in this repository. Then read
[architecture.md](./architecture.md) for system boundaries and
[execution-plan.md](./execution-plan.md) for priorities and phase status.
Operational commands and API details are in the root [README.md](../README.md).

## What this project is

Event-Sourced Ledger is a TypeScript banking application with a React frontend,
an Express banking backend, PostgreSQL, separate Identity and Customer
Services, and an API Gateway. The product name **NexusBank** is used in
planning but is not yet a confirmed replacement for the repository/project
name.

The banking backend is still a modular monolith. Do not describe the repository
as a set of fully independent domain microservices: Identity, Customer, and
Gateway are separate Node processes, while Banking remains a modular monolith.
The services still share a PostgreSQL database and login.

The ledger is built around transactions and debit/credit ledger entries whose
balances are calculated from entries. The current schema does not include a
general-purpose `ledger_events` event store, transactional outbox, SQS, a
Notification Service, or a Reporting Service. See the terminology note in
`architecture.md` before using "event-sourced" to describe implementation
details.

## Current priority

Phase 2 full-stack integration verification remains incomplete. Phases 3
Identity extraction, 4 Customer Service extraction, and 5 Banking Core
boundary are complete. See `execution-plan.md` for acceptance criteria and
remaining work.

## Important invariants

- Never rewrite or bypass the existing ledger to make an integration shortcut.
- Keep debit, credit, and transaction records atomic.
- Keep balances derived from ledger entries; do not introduce a mutable balance
  without an explicit consistency design.
- Preserve request idempotency, concurrency protection, JWT checks, and
  resource ownership rules.
- Customer provisioning is internal service-to-service behavior. Do not expose
  its endpoint through the public Gateway or frontend.
- Database migrations must preserve existing customer IDs, credentials, and
  financial history. Never use destructive schema/data operations casually.
- Do not commit secrets. Do not bake environment files or dependencies into
  Docker images.
- Treat AWS, SQS, SES, and proposed service boundaries as plans until
  implemented and verified.

## Repository map

Paths are relative to the backend repository root:

| Path | Use |
|---|---|
| `src/modules/` | Banking backend modules: bank accounts, banking, transactions, ledger, and idempotency. |
| `src/middleware/` | Authentication, ownership, idempotency, and error handling. |
| `src/database/` | PostgreSQL pool and startup seed. |
| `migrations/` | Ordered TypeScript schema migrations, including the credential backfill into `identity.credentials`. |
| `services/identity-service/` | Sole auth HTTP application, Identity-owned credential repository, database client, and customer provisioning client. |
| `services/customer-service/` | Customer profile API and sole application owner of the `customer.customers` schema. |
| `services/api-gateway/` | Public API route proxying and internal route deny rule. |
| `frontend/src/features/` | React features for auth, customers, accounts, dashboard, deposits, ledger, transactions, transfers, and withdrawals. |
| `docker-compose.yml` | Local six-service orchestration and dependencies. |
| `tests/` | Backend concurrency, integration, and other Vitest tests. |
| `frontend/tests/`, `frontend/src/test/` | Frontend test suites. |
| `docs/` | Architecture, plan, and agent context. Keep these aligned with actual code. |

## Development and verification

Run commands from the relevant package directory:

```text
backend:                       npm test
backend production build:      npm run build
Identity Service:              cd services/identity-service && npm run build
Customer Service:              cd services/customer-service && npm run build
API Gateway:                   cd services/api-gateway && npm run build
frontend production build:      cd frontend && npm run build
Docker Compose validation:     docker compose config
Docker Compose local startup:  docker compose up --build -d
```

Use the tests/builds affected by a change first, then broaden validation as
needed. Docker requires a running engine; a successful `docker compose config`
does not prove an image or container runs.

### Known validation context

On 2026-11-13, the backend suite passed (156 tests across 18 files), and
frontend tests passed (32 tests across 11 files). Backend and frontend lint,
typechecks, and production builds passed; Identity, Customer, and Gateway
builds passed. The credential migration was rehearsed up/down against a
synthetic local fixture with IDs, email, and password hash preserved. The
customer-table migration was rehearsed down/up against `ledger_test` with its
table OID, rows, and foreign keys preserved. The Customer Service image built
and Compose configuration validated. Banking Core Gateway integration,
API contract tests, backend lint/typecheck/build, Gateway build, and Compose
configuration validation passed for Phase 5. Hosted GitHub CI has not run for
the uncommitted changes.

The local five-service Compose stack was built and started successfully on
2026-11-11; all five services reached healthy status. The Docker backend
entrypoint normalizes CRLF at image build time to support Windows worktrees.

## Working agreement for agents

1. Inspect the current code, git status, relevant tests, and applicable docs
   before editing. The worktree can contain user changes; do not revert them.
2. Make the smallest complete change consistent with existing patterns and
   update directly related docs.
3. For financial code, explain the affected invariants and add regression
   tests for failure/concurrency/idempotency behavior as applicable.
4. When changing routes, check all callers, Gateway routing, frontend API
   usage, internal endpoint exposure, and health checks.
5. When changing database ownership or schema, document the migration,
   rollback, and data-preservation strategy.
6. Report commands actually run and distinguish successful builds/config
   validation from tests or container execution.
7. Keep this context, architecture, and phase status factual; mark proposals
   and unresolved decisions explicitly.
