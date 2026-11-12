# Customer Service

Customer Service is the authoritative owner of customer profile reads and
writes. It stores profiles in `customer.customers`; the schema was introduced
by moving the existing `public.customers` table, preserving its rows, UUIDs,
indexes, and foreign-key references from Banking and legacy credential data.

## Public profile API

All routes require a valid Banking-compatible JWT. Customers can access only
their own profile.

| Method | Path | Behavior |
|---|---|---|
| `GET` | `/api/v1/customers/me` | Read the authenticated customer's profile. |
| `GET` | `/api/v1/customers/:customerId` | Read the authenticated customer's profile; other IDs return 404. |
| `PATCH` | `/api/v1/customers/me` | Update the authenticated customer's name and/or phone. |
| `PATCH` | `/api/v1/customers/:customerId` | Update the authenticated customer's name and/or phone; other IDs return 404. |

Email is intentionally not editable through this API because it is also the
Identity Service's login identifier. An email-change flow must coordinate both
services before that field can be changed.

## Internal service API

These routes require the `x-internal-service-secret` header and are never
exposed by the API Gateway:

| Method | Path | Caller | Behavior |
|---|---|---|---|
| `POST` | `/api/v1/internal/customers` | Identity Service | Create a normalized customer profile. |
| `GET` | `/api/v1/internal/customers/:customerId` | Banking backend | Verify that a customer exists; returns only the customer ID. |

Duplicate emails and phone numbers return 409, missing profiles return 404,
and invalid input returns 400.

## Local development

Copy `.env.example` to `.env`, set the shared PostgreSQL, JWT, and provisioning
secret values, then run `npm install`, `npm run build`, and `npm start`.
The Banking backend remains the sole migration executor; run migrations before
starting the service. In Docker Compose, Customer Service waits for the
`customer.customers` schema to become ready.

Customer Service and Banking still share a PostgreSQL database and login.
Schema ownership and service APIs remove application-level direct customer
queries from Banking, but separate database roles/instances remain a
hardening task. The database foreign keys are retained to protect referential
integrity while both schemas share PostgreSQL.
