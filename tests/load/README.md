# k6 load tests

These scripts target the implemented `/api/v1` Express routes. Amounts are decimal strings and every banking write uses a fresh UUID-formatted `Idempotency-Key`. There is currently no authentication middleware.

## Install and run

Start PostgreSQL, apply migrations, and start the backend:

```powershell
cd backend
npm run migrate:up
npm run dev
```

Install k6 using the [official instructions](https://grafana.com/docs/k6/latest/set-up/install-k6/). On Windows: `winget install k6 --source winget`.

Run from `backend`:

```powershell
k6 run tests/load/deposit.js
k6 run tests/load/withdraw.js
k6 run tests/load/transfer.js
k6 run tests/load/balance.js
k6 run tests/load/history.js
k6 run tests/load/mixed-workload.js
```

Tune target, virtual users, duration, and setup-account count with environment variables:

```powershell
k6 run -e BASE_URL=http://localhost:5000 -e VUS=50 -e DURATION=5m -e ACCOUNT_COUNT=100 tests/load/mixed-workload.js
```

Defaults in `config.js` are 10 VUs, one minute, 20 accounts, and `10,000,000.00` opening balance. Set `INITIAL_ACCOUNT_BALANCE` higher for very long withdrawal-heavy runs.

## Workloads and results

| Script | Measures |
| --- | --- |
| `deposit.js` | Deposit latency, throughput, success rate, p95, and p99. |
| `withdraw.js` | Funded-account withdrawal stress without insufficient-funds noise. |
| `transfer.js` | Valid multi-account transfers with no self-transfer. |
| `balance.js` | Read-heavy, high-concurrency balance lookups. |
| `history.js` | Random accounts, pages, valid page sizes, and sort directions. |
| `mixed-workload.js` | 50% balance, 20% deposit, 15% withdraw, 15% transfer. |

The end summary exposes throughput as `http_reqs`, success as `operation_success`, and latency in `http_req_duration` plus an operation-specific trend. Thresholds enforce `http_req_failed < 1%`, p95 below 200 ms, success above 99%, and operation p99 below 500 ms. A threshold failure exits non-zero.

Export a report with:

```powershell
k6 run --summary-export=load-summary.json tests/load/mixed-workload.js
```

For Prometheus or Grafana Cloud outputs, see [k6 results output](https://grafana.com/docs/k6/latest/results-output/). Raise `VUS` gradually with duration fixed, watch p95/p99 and error rate, then extend duration once the target load is stable.

## Test-data behavior

The project seed creates system ledger accounts only. Each script's one-time k6 `setup()` creates active SAVINGS accounts via the real customer/account endpoints and funds them via the real deposit endpoint. Setup traffic is outside measured iterations. The suite adds customers and immutable ledger events, so run it against a dedicated load-test database rather than production data.
