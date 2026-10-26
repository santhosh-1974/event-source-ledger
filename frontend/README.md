# Event-Sourced Ledger - Frontend

A modern, production-quality React frontend for the Event-Sourced Ledger banking system. Built with TypeScript, Vite, Tailwind CSS, and shadcn/ui components.

## Overview

This frontend provides a professional dashboard for managing customers, accounts, deposits, withdrawals, transfers, and transaction history. It integrates directly with the backend's event-sourced ledger API, showcasing the power of double-entry accounting and immutable financial events.

## Technology Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 8
- **Styling**: Tailwind CSS 3.4
- **UI Components**: Custom shadcn/ui-inspired components
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: React Router 7
- **Forms**: React Hook Form with Zod validation
- **Icons**: Lucide React
- **Charts**: Recharts
- **Testing**: Vitest + React Testing Library
- **Linting**: oxlint

## Features

### Dashboard
- Overview of total customers and accounts
- Quick action buttons for common operations
- Event sourcing explanation panel

### Customer Management
- List all customers with search functionality
- Create new customers with validation
- View customer details (name, email, phone, creation date)

### Account Management
- List all bank accounts with search
- Create new accounts linked to customers
- View account status (ACTIVE, BLOCKED, CLOSED)
- Account type support (SAVINGS, CURRENT)
- Quick navigation to ledger history

### Financial Operations
- **Deposits**: Deposit money into accounts with idempotency
- **Withdrawals**: Withdraw money with balance validation
- **Transfers**: Transfer between accounts with double-entry bookkeeping
- All operations include:
  - UUID-based idempotency keys
  - Success/failure notifications
  - Transaction reference display
  - Copy-to-clipboard functionality

### Transaction Explorer
- Search transactions by account number
- Paginated transaction history
- Transaction type badges (CREDIT/DEBIT)
- Amount formatting with color coding
- Detailed transaction view with ledger entries

### Ledger History
- Real-time balance queries
- Historical balance reconstruction at specific timestamps
- Event sourcing visualization
- Complete transaction timeline
- Pagination support

### API Documentation
- Embedded Swagger UI from backend
- Interactive API explorer

## Installation

### Prerequisites

- Node.js 18+ installed
- Backend server running on `http://localhost:5000`
- PostgreSQL database configured

### Setup Steps

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file in the frontend directory:
   ```env
   VITE_API_BASE_URL=http://localhost:5000/api/v1
   ```

   Or copy from the example:
   ```bash
   cp .env.example .env
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:5173`

## Development Commands

### Running the Application
```bash
npm run dev          # Start development server
npm run preview      # Preview production build
```

### Building
```bash
npm run build        # Build for production
```

### Testing
```bash
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
```

### Code Quality
```bash
npm run typecheck    # TypeScript type checking
npm run lint         # Run linter
npm run lint:fix     # Fix linting issues automatically
```

## Project Structure

```
frontend/
├── src/
│   ├── app/                    # Application configuration
│   │   ├── App.tsx            # Root component
│   │   ├── providers.tsx      # React Query provider
│   │   └── router.tsx         # React Router configuration
│   ├── components/
│   │   ├── layout/            # Layout components
│   │   │   ├── sidebar.tsx    # Navigation sidebar
│   │   │   ├── header.tsx     # Top header
│   │   │   └── shell.tsx      # Layout shell
│   │   ├── ui/                # Reusable UI components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── badge.tsx
│   │   │   └── table.tsx
│   │   └── shared/            # Shared components
│   ├── features/              # Feature modules
│   │   ├── dashboard/         # Dashboard page
│   │   ├── customers/         # Customer management
│   │   ├── accounts/          # Account management
│   │   ├── deposits/          # Deposit operations
│   │   ├── withdrawals/       # Withdrawal operations
│   │   ├── transfers/         # Transfer operations
│   │   ├── transactions/      # Transaction explorer
│   │   └── ledger/            # Ledger history
│   ├── lib/
│   │   ├── api-client.ts      # Centralized API client
│   │   ├── query-client.ts    # React Query configuration
│   │   ├── formatters.ts      # Currency, date, number formatters
│   │   ├── types/             # TypeScript type definitions
│   │   │   └── api.ts
│   │   ├── config/            # Configuration
│   │   │   └── index.ts
│   │   └── utils.ts           # Utility functions
│   ├── test/                  # Test utilities and setup
│   │   ├── setup.ts
│   │   ├── vitest.d.ts
│   │   ├── formatters.test.ts
│   │   ├── api-client.test.ts
│   │   ├── deposit-form.test.tsx
│   │   └── transfer-form.test.tsx
│   ├── index.css              # Global styles
│   └── main.tsx               # Application entry point
├── public/                    # Static assets
├── .env.example               # Environment variables template
├── index.html                 # HTML template
├── package.json               # Dependencies and scripts
├── tailwind.config.js         # Tailwind CSS configuration
├── tsconfig.json              # TypeScript configuration
├── tsconfig.app.json          # App-specific TypeScript config
├── tsconfig.node.json         # Node-specific TypeScript config
├── vite.config.ts             # Vite configuration
└── vitest.config.ts           # Vitest configuration
```

## API Integration

The frontend uses a centralized API client (`src/lib/api-client.ts`) that:

- Manages all HTTP requests to the backend
- Handles error responses consistently
- Supports idempotency for financial operations
- Provides typed request/response interfaces
- Handles network errors gracefully

### API Endpoints Used

- `GET /customers` - List all customers
- `POST /customers/create-customer` - Create customer
- `GET /customers/:customerId` - Get customer details
- `GET /accounts` - List all accounts
- `POST /accounts` - Create account
- `POST /banking/deposit` - Deposit money (requires Idempotency-Key header)
- `POST /banking/withdraw` - Withdraw money (requires Idempotency-Key header)
- `POST /banking/transfer` - Transfer money (requires Idempotency-Key header)
- `GET /banking/:accountNumber/balance` - Get current balance
- `GET /banking/:accountNumber/balance?at=timestamp` - Get historical balance
- `GET /banking/:accountNumber/history` - Get transaction history
- `GET /transactions/:transactionId` - Get transaction details
- `GET /health` - Health check

## Idempotency Handling

All financial operations (deposit, withdraw, transfer) use UUID-based idempotency keys:

1. A new UUID is generated for each operation
2. The key is sent in the `Idempotency-Key` header
3. If the request is retried with the same key, the backend returns the cached response
4. This prevents duplicate transactions on network retries

## Error Handling

The application handles various error scenarios:

- **Network errors**: Displayed when the backend is unreachable
- **Validation errors**: Shown inline with form fields
- **404 errors**: Displayed when resources are not found
- **409 conflicts**: Shown for insufficient funds or duplicate requests
- **500 errors**: Generic server error message

All errors are user-friendly and do not expose stack traces or internal details.

## Responsive Design

The application is fully responsive and works on:

- **Desktop** (1024px+): Full sidebar, expanded layout
- **Tablet** (768px-1023px): Collapsible sidebar
- **Mobile** (<768px): Drawer-style navigation

## Testing

Frontend tests cover:

- Formatter utilities (currency, dates, account numbers)
- API client error handling
- Form validation (deposit, transfer)
- Form submission states
- Required field validation

Run tests with:
```bash
npm test
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:5000/api/v1` |

## Backend Requirements

Before running the frontend, ensure the backend is:

1. **Installed and configured**:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Configure database connection in .env
   npm run migrate:up
   npm run seed
   ```

2. **Running**:
   ```bash
   npm run dev
   ```

   The backend should be available at `http://localhost:5000`

3. **Database**: PostgreSQL running and accessible

## Known Limitations

- No authentication/authorization implemented (backend doesn't support it yet)
- Currency is hardcoded to INR (₹)
- No dark mode implementation (can be added via Tailwind dark mode)
- Real-time updates not implemented (would require WebSockets)
- Account editing/deletion not fully implemented

## Future Enhancements

Potential improvements:

- Dark mode support
- Multi-currency support
- Real-time balance updates via WebSockets
- Account statement generation (PDF export)
- Advanced filtering and sorting
- Charts for account balance trends
- Transaction search by date range
- Bulk operations
- Customer profile photos
- Two-factor authentication (when backend supports auth)

## Production Deployment

For production deployment:

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Configure production environment**:
   Set `VITE_API_BASE_URL` to your production backend URL

3. **Serve the dist folder**:
   Using any static file server (nginx, Apache, Vercel, Netlify, etc.)

Example with nginx:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend-server:5000;
    }
}
```

## Troubleshooting

### Frontend won't connect to backend
- Verify backend is running on `http://localhost:5000`
- Check `VITE_API_BASE_URL` in `.env`
- Ensure CORS is enabled on the backend

### Build fails
- Run `npm run typecheck` to check for TypeScript errors
- Run `npm run lint` to check for linting issues
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

### Tests fail
- Ensure `@testing-library/jest-dom` is installed
- Check that vitest.d.ts is properly configured
- Verify test mocks are correctly set up

## License

This frontend is part of the Event-Sourced Ledger project. See the main project license for details.

## Author

**Santhosh Masupalli**

Frontend built to demonstrate professional React development and integration with an event-sourced banking backend.
