# Product Idea

## Current project

**Event-Sourced Ledger** is a production-inspired banking application with a
React frontend, TypeScript/Express APIs, PostgreSQL persistence, and a
double-entry ledger. It supports customer registration, accounts, deposits,
withdrawals, transfers, balances, and transaction history.

The project emphasizes financial correctness:

- Record financial operations with transaction and debit/credit ledger entries.
- Derive balances from ledger entries rather than directly overwriting a
  balance field.
- Use database transactions, idempotency, and concurrency controls to protect
  money movement.
- Preserve an auditable history of financial activity.

The current application uses a ledger-based double-entry design. Its schema
does not yet implement a general-purpose replayable domain-event store. See
[architecture.md](./architecture.md) for verified implementation details.

## Product naming

**NexusBank** is a proposed customer-facing product name used in prior
architecture discussions. The repository/project name remains Event-Sourced
Ledger until the owner confirms the naming direction.

## Direction

Stabilize the existing frontend and backend integration first. Then evolve
service boundaries incrementally, keep Accounts and Ledger within one
transactional Banking Core, and only add asynchronous notifications after a
transactional outbox is in place.

See [execution-plan.md](./execution-plan.md) for the phased roadmap and
[AI_CONTEXT.md](./AI_CONTEXT.md) for contributor/agent guidance.
