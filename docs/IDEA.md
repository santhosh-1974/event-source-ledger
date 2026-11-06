Build **event-sourced-ledger**, a double-entry ledger whose balances are derived from an immutable event log.

- Record deposits, withdrawals, and transfers as validated, append-only events.
- Replay events to reconstruct account balances and verify ledger consistency.
- Make transaction requests idempotent to prevent duplicate entries.
- Provide a CLI to post transactions, inspect balances, and export an audit history.
