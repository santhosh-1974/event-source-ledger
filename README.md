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
```

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

# Running Tests

Run all tests

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
| POST | `/api/v1/customers/create-customer` |
| GET | `/api/v1/customers` |
| GET | `/api/v1/customers/:customerId` |

---

## Accounts

| Method | Endpoint |
|---------|----------|
| POST | `/api/v1/accounts/create-account` |
| GET | `/api/v1/accounts` |
| GET | `/api/v1/accounts/:accountNumber` |

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

# Security

- Input validation using Zod
- Parameterized SQL queries
- ACID database transactions
- Row-level locking for concurrent operations
- Idempotent write requests
- Centralized error handling
- Secure HTTP headers using Helmet
- CORS enabled
- Structured logging using Pino

---

# Future Improvements

- Authentication & Authorization
- JWT-based user login
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