# AI Agent Project Context

Read this file first when beginning work in this repository. Then read
[architecture.md](./architecture.md) for system boundaries and
[execution-plan.md](./execution-plan.md) for priorities and phase status.
Operational commands and API details are in the root [README.md](../README.md).

## What this project is

Event-Sourced Ledger is a TypeScript banking application with a React frontend,
an Express banking backend, PostgreSQL, a separate Identity Service, and an API
Gateway. The product name **NexusBank** is used in planning but is not yet a
confirmed replacement for the repository/project name.

The banking backend is still a modular monolith. Do not describe the repository
as a set of fully independent domain microservices: Identity and Gateway are
separate Node processes, while Customer and Banking domains still share the
banking backend and PostgreSQL database.

The ledger is built around transactions and debit/credit ledger entries whose
balances are calculated from entries. The current schema does not include a
general-purpose `ledger_events` event store, transactional outbox, SQS, a
Notification Service, or a Reporting Service. See the terminology note in
`architecture.md` before using "event-sourced" to describe implementation
details.

## Current priority

Phase 2, stabilizing frontend/backend integration, is next. The existing
frontend, nginx proxy, Gateway, Identity Service, internal customer
provisioning contract, and banking backend should be verified end to end before
adding more service boundaries. The full phase order and acceptance criteria
are in `execution-plan.md`.

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
| `src/modules/` | Banking backend modules: auth, customers, bank accounts, banking, transactions, ledger, and idempotency. |
| `src/middleware/` | Authentication, ownership, idempotency, and error handling. |
| `src/database/` | PostgreSQL pool and startup seed. |
| `migrations/` | Ordered TypeScript schema migrations. |
| `services/identity-service/` | Auth HTTP application, user repository, database client, customer provisioning client. |
| `services/api-gateway/` | Public API route proxying and internal route deny rule. |
| `frontend/src/features/` | React features for auth, customers, accounts, dashboard, deposits, ledger, transactions, transfers, and withdrawals. |
| `docker-compose.yml` | Local five-service orchestration and dependencies. |
| `tests/` | Backend concurrency, integration, and other Vitest tests. |
| `frontend/tests/`, `frontend/src/test/` | Frontend tests; discovery and existing test failures need follow-up. |
| `docs/` | Architecture, plan, and agent context. Keep these aligned with actual code. |

## Development and verification

Run commands from the relevant package directory:

```text
backend:                       npm test
backend production build:      npm run build
Identity Service:              cd services/identity-service && npm run build
API Gateway:                   cd services/api-gateway && npm run build
frontend production build:      cd frontend && npm run build
Docker Compose validation:     docker compose config
Docker Compose local startup:  docker compose up --build -d
```

Use the tests/builds affected by a change first, then broaden validation as
needed. Docker requires a running engine; a successful `docker compose config`
does not prove an image or container runs.

### Known validation context

On 2026-11-11, the backend suite passed (150 tests across 15 files), and the
backend, Identity Service, Gateway, and frontend production builds passed. A
full frontend test run reported 14 passed and 14 failed across 12 files; the
`test:frontend` script matched no files. Re-run tests before relying on this
baseline because it may become stale. Do not fix unrelated existing failures
unless they block the current task.

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
