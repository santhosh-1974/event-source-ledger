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
- Ledger Model
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
- Project Documentation
- License

---

## Project Documentation

- [AI agent project context](docs/AI_CONTEXT.md) — start here for current
  repository facts and contributor guardrails.
- [Architecture](docs/architecture.md) — current system, proposed target, and
  design decisions.
- [Execution plan](docs/execution-plan.md) — phases, status, and acceptance
  criteria.
- [Product idea](docs/IDEA.md) — project intent and naming context.

---

# Overview

Traditional CRUD banking applications overwrite balances directly.

The project uses a PostgreSQL-backed double-entry ledger. Financial operations
create transaction records and debit/credit ledger entries, and account
balances are calculated from those entries.

Instead of asking:

> "What is the balance?"

The system answers:

> "Aggregate the ledger entries and calculate the balance."

This provides:

- Complete audit history
- No direct balance overwrite in the banking operations
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

- Ledger-derived balances
- Double-entry bookkeeping
- Auditable transaction and entry history

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

The frontend is served by nginx and sends API requests through the API Gateway.
The Gateway routes authentication to Identity, customer profiles to Customer
Service, and banking operations to the Banking backend. The banking domain
remains a modular monolith; the services still share one PostgreSQL database.
See [the architecture guide](docs/architecture.md) for verified current and
proposed architectures.

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
│   │   ├── bank-accounts
│   │   ├── banking
│   │   ├── idempotency
│   │   ├── ledger
│   │   └── transactions
│   ├── routes
│   └── server.ts
│
├── migrations
├── services
│   ├── api-gateway
│   ├── customer-service
│   ├── identity-service
│   └── notification-service
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

# Ledger Model

The current schema stores financial transactions in `transactions` and their
debit/credit postings in `ledger_entries`. Balances are calculated by
aggregating ledger entries; they are not a mutable account balance field.

The repository is named Event-Sourced Ledger, but the current schema does not
implement a general-purpose replayable domain-event store. The transactional
outbox and asynchronous event publishing are future roadmap work.

Financial writes use database transactions, idempotency, and concurrency
controls. For schema details and invariants, see
[the architecture guide](docs/architecture.md).

---

# Double-Entry Accounting

Every transfer creates four ledger entries: a balanced debit/credit pair from
the sender account to the system Cash ledger and another pair from Cash to the
receiver account. All four entries and the transaction record commit together.

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
http://localhost:5000/api-docs
```

The versioned Banking Core contract is also routed through the Gateway under
`/api/v1`. The Gateway only forwards the documented accounts, banking, and
transactions resources. OpenAPI provides:

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
CUSTOMER_PROVISIONING_SECRET=<generate-a-random-secret>
CUSTOMER_SERVICE_URL=http://localhost:5002
```

---

## Docker Deployment

### Prerequisites

- Docker Engine and Docker Compose v2

### Quick Start with Docker Compose

1. Copy `.env.example` to `.env` in the backend directory.

2. Set `DATABASE_PASSWORD`, `JWT_SECRET`, and `CUSTOMER_PROVISIONING_SECRET` in `.env` to unique random values. For example, generate each value with:

```bash
openssl rand -hex 32
```

3. Build and start the services:

```bash
docker compose up --build -d
```

The frontend is available at `http://localhost:5173`. Browser API calls go
through the API Gateway; Customer Service is not published to the host.

View logs and service health:

```bash
docker compose logs -f
docker compose ps
```

Stop the containers while preserving the database volume:

```bash
docker compose down
```

### Docker Services

Compose starts PostgreSQL 17 and the Banking backend applies pending migrations and an idempotent initial seed. Customer Service waits for its schema to be ready; Identity and Notification wait for their dependencies; Gateway waits for all routed services; and the frontend waits for Gateway. All seven services have health checks. PostgreSQL data is stored in the `ledger-postgres-data` named volume and is preserved by `docker compose down`.

The internal service URLs are `postgres:5432`, `http://banking-backend:5000`, `http://identity-service:5001`, `http://customer-service:5002`, `http://notification-service:5003`, and `http://api-gateway:4000`. Customer Service is not published to the host; internal customer routes are blocked at the Gateway. Notification's SQS consumer and SES sender are disabled by default; see [Notification Service operations](docs/notifications.md) before enabling them.

### Building Individual Services

Run from the backend directory:

```bash
docker build -t banking-backend .
docker build -t identity-service ./services/identity-service
docker build -t customer-service ./services/customer-service
docker build -t api-gateway ./services/api-gateway
docker build -t notification-service ./services/notification-service
docker build -t frontend ./frontend
```

### Production Considerations

- Never commit `.env`; it is excluded from all image build contexts.
- Keep `CUSTOMER_PROVISIONING_SECRET` private; Identity, Customer Service, and Banking use it for internal service calls.
- The production images use multi-stage builds and Node.js 22 for the Node services.
- Do not remove the `ledger-postgres-data` volume unless you intend to delete the database.

---

# Authentication

Registration is public at `POST /api/v1/auth/register` and login is public at
`POST /api/v1/auth/login`; both are routed by the Gateway to the Identity
Service. Identity stores credentials in the `identity.credentials` schema and
provisions customer profiles through Customer Service's protected internal
API. Customer profiles are read and updated through the Customer Service via
the Gateway; customers can update name and phone, while email changes remain
unsupported to keep the login identifier consistent. Passwords must be 12–72 bytes. Registration expects `name`, `email`,
`phone`, and `password`; login expects `email` and `password`.

Customer creation and credential persistence span two services and are not one
database transaction. If credential persistence fails after customer
provisioning, Identity reports a server error and logs the customer ID for
reconciliation; it does not silently claim registration succeeded.

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
| GET | `/api/v1/banking/:accountNumber/balance?at=<ISO-8601 timestamp>` |
| GET | `/api/v1/banking/:accountNumber/history` |

All routes require a bearer JWT. Deposit, withdrawal, and transfer also require
a UUID `Idempotency-Key`. The caller must own the relevant account; transfers
require ownership of both accounts. Ownership failures return 404. See the
[API Gateway contract](services/api-gateway/README.md#banking-core-api-v1-contract)
for response and error behavior.

---

## Transactions

| Method | Endpoint |
|---------|----------|
| GET | `/api/v1/transactions/:transactionId` |

---

## Notification Preferences

| Method | Endpoint |
|---------|----------|
| GET | `/api/v1/notifications/preferences` |
| PUT | `/api/v1/notifications/preferences` |

Both require a bearer JWT and apply only to the authenticated customer. Email
is opt-in; enabling it requires both `emailEnabled: true` and `consent: true`.
See [Notification Service operations](docs/notifications.md) for retry, DLQ,
and replay behavior.

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
- Notification consent, delivery deduplication, retries, and replay

Current test suite:

```
See `npm test` for the current passing test count.
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