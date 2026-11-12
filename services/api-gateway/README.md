# API Gateway

Lightweight API Gateway for the NexusBank event-sourced ledger application.

## Overview

The API Gateway serves as the single entry point for all client requests, routing them to the appropriate backend services:
- **Identity Service**: Handles authentication and user credentials
- **Customer Service**: Owns customer profiles
- **Banking Service**: Handles all banking operations, accounts, and transactions

## Architecture

```
Client → API Gateway (4000) → Identity Service (5001) [/api/v1/auth/*]
                            → Customer Service (5002) [/api/v1/customers/*]
                            → Banking Service (5000) [other /api/v1/*]
```

## Features

- **Lightweight proxy**: Uses `http-proxy-middleware` for efficient request forwarding
- **Request routing**: Routes based on URL paths to appropriate services
- **Security**: Blocks access to internal endpoints (e.g., `/internal/customers`)
- **CORS**: Configured to work with the existing frontend
- **Health check**: `GET /health` endpoint for monitoring
- **Request logging**: Uses Pino for structured logging
- **Graceful shutdown**: Handles SIGTERM/SIGINT signals properly
- **Error handling**: Returns appropriate error responses when services are unavailable

Identity calls Customer Service's protected provisioning API. Customer Service
owns profile data in `customer.customers`; the Banking backend calls its
protected customer-existence endpoint before account creation. The backend's
former customer and auth handlers are removed. Internal service routes are
blocked by the Gateway.

## Configuration

Environment variables (`.env`):

```env
PORT=4000
IDENTITY_SERVICE_URL=http://localhost:5001
CUSTOMER_SERVICE_URL=http://localhost:5002
BANKING_SERVICE_URL=http://localhost:5000
NODE_ENV=development
LOG_LEVEL=info
```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server

## Routes

### Health Check
- `GET /health` - API Gateway health status

### Proxied Routes
- `POST /api/v1/auth/register` → Identity Service
- `POST /api/v1/auth/login` → Identity Service
- `GET, PATCH /api/v1/customers/*` → Customer Service
- `GET /api/v1/accounts/*` → Banking Service
- `POST /api/v1/banking/*` → Banking Service
- `GET /api/v1/transactions/*` → Banking Service
- All other `/api/v1/*` routes → Banking Service

### Blocked Routes
- `/api/v1/internal/*` - Internal service-to-service endpoints are not exposed

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file based on `.env.example`

3. Start in development mode:
   ```bash
   npm run dev
   ```

## Production

1. Build the project:
   ```bash
   npm run build
   ```

2. Start the server:
   ```bash
   npm start
   ```

## Testing

Start all services:

```bash
# Terminal 1: Banking Service
cd backend
npm run dev

# Terminal 2: Identity Service
cd backend/services/identity-service
npm run dev

# Terminal 3: Customer Service
cd backend/services/customer-service
npm run dev

# Terminal 4: API Gateway
cd backend/services/api-gateway
npm run dev
```

Test endpoints:

```bash
# Health check
curl http://localhost:4000/health

# Register (via gateway)
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","phone":"1234567890","password":"TestPassword123"}'

# Login (via gateway)
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPassword123"}'

# Get customer profile (via gateway)
curl http://localhost:4000/api/v1/customers/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Update name and phone (email remains tied to the login identity)
curl -X PATCH http://localhost:4000/api/v1/customers/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Name","phone":"1234567891"}'
```

## Security Considerations

- The API Gateway blocks access to internal endpoints
- CORS is configured to match existing service settings
- All requests preserve headers including Authorization tokens
- Service URLs should be configured via environment variables
- In production, use HTTPS and configure appropriate CORS origins
