# Event-Sourced Ledger

> A production-inspired banking ledger built with **Node.js**, **TypeScript**, **Express**, and **PostgreSQL** that implements **Event Sourcing**, **Double-Entry Accounting**, **ACID Transactions**, **Idempotency**, and **Concurrency-Safe Money Transfers**.

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Node.js](https://img.shields.io/badge/Node.js-22-green)
![Express](https://img.shields.io/badge/Express-5.x-black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-blue)
![License](https://img.shields.io/badge/license-MIT-green)

> Add your GitHub Actions badge here after CI is working.

---

# Table of Contents

- Overview
- Features
- Architecture
- Tech Stack
- Project Structure
- Database Design
- Event Sourcing
- Double-Entry Accounting
- Idempotency
- API Documentation
- Getting Started
- Environment Variables
- Running the Project
- Running with Docker Compose
- Running Tests
- API Endpoints
- Testing Strategy
- Security
- Future Improvements
- License

---

# Overview

Traditional CRUD banking applications overwrite balances directly.

This project follows an **Event-Sourced Ledger** approach where every financial operation is stored as an immutable event.

Instead of asking:

> "What is the balance?"

The system answers:

> "Replay all ledger events and calculate the balance."

This provides:

- Complete audit history
- No hidden balance mutations
- Easy debugging
- Historical balance queries
- Strong transactional consistency

---

# Features

## Banking

- Create customers
- Create bank accounts
- Deposit money
- Withdraw money
- Transfer money
- Balance lookup
- Historical balance lookup
- Transaction history
- Transaction lookup

---

## Ledger

- Event Sourcing
- Immutable ledger entries
- Double-entry bookkeeping
- Complete audit trail

---

## Reliability

- PostgreSQL ACID transactions
- Rollback on failure
- Idempotent requests
- Concurrency-safe transfers
- Row locking
- Atomic commits

---

## Developer Experience

- TypeScript
- Express 5
- PostgreSQL
- Zod validation
- Swagger / OpenAPI
- ESLint
- Vitest
- GitHub Actions
- Health checks

---

# Architecture

```
                Client
                   │
                   ▼
             Express Server
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
    Controllers         Health Checks
         │
         ▼
      Services
         │
         ▼
    Repositories
         │
         ▼
     PostgreSQL
```

---

# Tech Stack

| Category | Technology |
|----------|------------|
| Language | TypeScript |
| Runtime | Node.js |
| Framework | Express 5 |
| Database | PostgreSQL |
| Validation | Zod |
| Logging | Pino |
| API Docs | Swagger UI |
| Testing | Vitest + Supertest |
| Migrations | node-pg-migrate |
| Linting | ESLint |

---

# Project Structure

```
backend
│
├── src
│   ├── config
│   ├── database
│   ├── docs
│   ├── errors
│   ├── health
│   ├── middleware
│   ├── modules
│   │   ├── accounts
│   │   ├── banking
│   │   ├── customers
│   │   ├── idempotency
│   │   ├── ledger
│   │   └── transactions
│   ├── routes
│   └── server.ts
│
├── migrations
│
├── tests
│   ├── concurrency
│   ├── helpers
│   └── integration
│
└── package.json
```

---

# Database Design

The system consists of the following main tables:

```
Customers
    │
    ▼
Bank Accounts
    │
    ▼
Transactions
    │
    ▼
Ledger Entries
    │
    ▼
Idempotency Keys
```

Each transaction creates immutable ledger entries instead of directly modifying balances.

---

# Event Sourcing

Every financial operation generates an immutable event.

Example:

```
Deposit ₹1000

↓

Transaction Created

↓

Ledger Entry Created

↓

Balance Calculated From Ledger
```

Nothing is overwritten.

Every event remains permanently stored.

Benefits:

- Full audit history
- Time travel queries
- Easier debugging
- Replay capability

---

# Double-Entry Accounting

Every transfer creates two ledger entries.

```
Transfer ₹1000

Account A
Debit 1000

↓

Account B
Credit 1000
```

Money is never created or destroyed.

This guarantees accounting consistency.

---

# Idempotency

All write operations support idempotent requests.

Clients can safely retry failed requests without creating duplicate deposits or transfers.

```
Client
   │
Retry Request
   │
Idempotency Key
   │
Already Processed?
   │
Yes
   │
Return Previous Response
```

---

# API Documentation

Swagger UI is available at:

```
/api-docs
```

It provides:

- Interactive API explorer
- Request examples
- Response examples
- Schema documentation

---

# Getting Started

## Clone

```bash
git clone <repository-url>

cd backend
```

---

## Install

```bash
npm install
```

---

## Configure

Create:

```
.env
```

Example:

```env
PORT=5000

NODE_ENV=development

DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=ledger_db
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password

LOG_LEVEL=info

IDEMPOTENCY_TTL_SECONDS=3600
IDEMPOTENCY_CLEANUP_INTERVAL_MS=3600000

JWT_SECRET=<generate-a-random-secret-at-least-32-characters>
JWT_EXPIRATION_HOURS=24
```

---

# Authentication

Registration is public at `POST /api/v1/auth/register` and creates the customer and password credential in one database transaction. Login is public at `POST /api/v1/auth/login`. Both accept validated JSON; passwords must be 12–72 bytes. Registration expects `name`, `email`, `phone`, and `password`. Login expects `email` and `password`.

Protected API calls require `Authorization: Bearer <token>`. Tokens use HS256, expire after `JWT_EXPIRATION_HOURS` (24 hours by default), and have no refresh-token flow in this phase. Generate a strong secret (at least 32 characters), provide it through `JWT_SECRET`, and never commit it. For example, `openssl rand -base64 48` can generate a value.

Customers can access only their own customer record and accounts. Transfers require ownership of both accounts. The legacy customer-creation route is disabled; customer creation must use registration. Account status changes, edits, and deletion remain disabled because they are administrative operations and no administrator authorization model exists.

---

## Run Migrations

```bash
npm run migrate:up
```

---

## Start Server

Development

```bash
npm run dev
```

Production

```bash
npm run build

npm start
```

---

# Running with Docker Compose

The whole stack — PostgreSQL, the banking backend, the identity service, the API
gateway, and the frontend — runs with a single command. Nothing needs to be
installed locally except Docker.

```bash
docker compose up --build -d
```

| Service | Container port | Host URL |
|---|---|---|
| `frontend` | 5173 | http://localhost:5173 |
| `api-gateway` | 4000 | http://localhost:4000 |
| `banking-backend` | 5000 | `127.0.0.1:5000` (loopback only, for direct API debugging) |
| `identity-service` | 5001 | `127.0.0.1:5001` (loopback only) |
| `postgres` | 5432 | `127.0.0.1:5432` (loopback only, for `psql`) |

The browser talks **only** to the frontend, and the frontend's JavaScript bundle
calls the API gateway at `http://localhost:4000/api/v1`. Nothing else is reachable
from another machine: the banking backend, identity service, and PostgreSQL are
all published on the loopback interface only. Inside the Compose network the
services reach each other by name (`http://banking-backend:5000`,
`http://identity-service:5001`).

## Start the stack

```bash
# optional: customise secrets and ports first
cp .env.example .env

docker compose up --build -d
```

Every variable in `.env.example` has a development-safe default in
`docker-compose.yml`, so the stack also boots with no `.env` file at all. For
anything beyond a local machine, set real secrets — especially `JWT_SECRET`
(minimum 32 characters) and `CUSTOMER_PROVISIONING_SECRET`.

## Check status

```bash
docker compose ps
```

All five services should report `running`, and the four with health checks
should reach `healthy`. Follow the logs with:

```bash
docker compose logs -f
```

## Verify it works

```bash
# gateway health
curl http://localhost:4000/health

# frontend
curl -I http://localhost:5173/

# end-to-end through the gateway
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada Lovelace","email":"ada@example.com","phone":"9876543210","password":"S3curePassw0rd!"}'
```

Then open http://localhost:5173 and sign in with that account.

## Startup order and migrations

Compose starts the services in dependency order using health-check-based
`depends_on`, so nothing accepts traffic before what it needs is ready:

```
postgres (healthy) -> banking-backend (healthy) -> identity-service (healthy)
                   -> api-gateway (healthy) -> frontend
```

Migrations run **once**, inside `docker/backend-entrypoint.sh`, before the
banking backend process starts. The entrypoint waits for PostgreSQL to accept
connections, applies every migration in `migrations/`, and only then starts
`node dist/server.js`. Because the migration runner records applied migrations in
the `pgmigrations` table, a restart prints `No migrations to run!` instead of
re-applying them.

Seeding is safe to repeat. The entrypoint counts the system ledger accounts and
seeds only when there are none; on later boots it logs
`system ledger accounts already present (N rows) — skipping seed`. Set
`SEED_ON_START=false` to skip seeding entirely, or `RUN_MIGRATIONS=false` to skip
migrations. Both default to `true`.

## Data persistence

PostgreSQL data lives in the named volume `postgres_data`, which survives
`docker compose down` and `docker compose up`.

```bash
docker compose down      # keeps all data
docker compose up -d     # data is still there
```

> **Warning:** `docker compose down -v` **deletes the volume and every row in the
> database**. It is not part of any normal workflow.

## Rebuild after changing code

```bash
docker compose up --build -d
```

If you change `VITE_API_BASE_URL`, the frontend must be rebuilt: it is baked into
the JavaScript bundle at build time. Compose passes it as a build argument
automatically.

## Configuration notes

- `.env` and `.env.*` files are excluded from every build context via
  `.dockerignore`. Secrets are injected at **runtime** by Compose, never baked
  into an image.
- Images run as non-root (`node` for the Node services, `nginx` for the frontend)
  and build in multiple stages, so compilers and dev dependencies never reach the
  runtime image.
- The internal customer-provisioning endpoint (`/internal/customers`) is rejected
  by the API gateway with `403`, so it is not exposed outside the network.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot connect to the Docker daemon` | Start Docker Desktop and wait for the engine. |
| `exec format error` / `no such file or directory` for `backend-entrypoint.sh` | The script lost its LF endings (Windows `core.autocrlf`). Run `git config core.autocrlf input` and re-checkout, or `docker compose build --no-cache banking-backend`. |
| Port already in use | Change `POSTGRES_HOST_PORT` in `.env`, or stop the conflicting process. |
| Backend restarts repeatedly | `docker compose logs banking-backend`. The entrypoint exits deliberately if PostgreSQL never becomes reachable inside `DB_WAIT_MAX_ATTEMPTS`. |

---

# Running Tests

Run all tests (requires a running PostgreSQL and a `.env.test` pointing at a
`ledger_test` database — see `tests/helpers/database.ts`)

```bash
npm test
```

Watch mode

```bash
npm run test:watch
```

Type checking

```bash
npm run typecheck
```

Lint

```bash
npm run lint
```

---

# API Endpoints

## Customers

| Method | Endpoint |
|---------|----------|
| POST | `/api/v1/auth/register` |
| POST | `/api/v1/auth/login` |
| GET | `/api/v1/customers/me` |
| GET | `/api/v1/customers/:customerId` (own customer only) |

---

## Accounts

| Method | Endpoint |
|---------|----------|
| POST | `/api/v1/accounts` (creates for the authenticated customer) |
| GET | `/api/v1/accounts` (own accounts only) |
| GET | `/api/v1/accounts/:accountId` (own account only) |

---

## Banking

| Method | Endpoint |
|---------|----------|
| POST | `/api/v1/banking/deposit` |
| POST | `/api/v1/banking/withdraw` |
| POST | `/api/v1/banking/transfer` |
| GET | `/api/v1/banking/:accountNumber/balance` |
| GET | `/api/v1/banking/:accountNumber/balance-at-time` |
| GET | `/api/v1/banking/:accountNumber/history` |

---

## Transactions

| Method | Endpoint |
|---------|----------|
| GET | `/api/v1/transactions/:transactionId` |

---

## Health

| Method | Endpoint |
|---------|----------|
| GET | `/health` |
| GET | `/ready` |

---

# Testing Strategy

The project includes automated tests covering:

- Customer APIs
- Account APIs
- Deposit
- Withdraw
- Transfer
- Transaction History
- Balance
- Historical Balance
- Idempotency
- Rollback
- Concurrency
- Health Checks

Current test suite:

```
141 Passing Tests
```

---

## Security

- Input validation using Zod
- Parameterized SQL queries
- ACID database transactions
- Row-level locking for concurrent operations
- Idempotent write requests
- Passwords hashed with bcrypt
- JWT authentication with environment-configured signing secret and expiry
- Ownership checks for customer, account, balance, history, transaction, and transfer routes
- Public health and readiness endpoints return operational status only
- Centralized error handling
- Secure HTTP headers using Helmet
- CORS enabled
- Structured logging using Pino

---

# Future Improvements

- Multi-currency support
- Interest calculation
- Scheduled payments
- Account statements (PDF)
- Prometheus metrics
- Redis caching
- Kubernetes deployment
- Event streaming with Kafka

---

# License

This project is licensed under the MIT License.

---

# Author

**Santhosh Masupalli**

Backend Developer focused on building reliable, scalable, and production-inspired backend systems using TypeScript, Node.js, PostgreSQL, and distributed systems concepts.