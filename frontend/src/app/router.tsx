import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
import { Providers } from './providers';
import { Shell } from '../components/layout/shell';
import { GuestOnly, RequireAuth } from '../components/auth/RequireAuth';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { Dashboard } from '../features/dashboard/dashboard';
import { Customers } from '../features/customers/customers';
import { Accounts } from '../features/accounts/accounts';
import { AccountDetail } from '../features/accounts/account-detail';
import { Deposits } from '../features/deposits/deposits';
import { Withdrawals } from '../features/withdrawals/withdrawals';
import { Transfers } from '../features/transfers/transfers';
import { Transactions } from '../features/transactions/transactions';
import { TransactionDetail } from '../features/transactions/transaction-detail';
import { LedgerHistory } from '../features/ledger/ledger-history';
import { Payments } from '../features/payments/payments';
import { Statements } from '../features/statements/statements';
import { Notifications } from '../features/notifications/notifications';
import { Security } from '../features/security/security';

const router = createBrowserRouter([
  {
    element: <Providers><Outlet /></Providers>,
    children: [
      { path: '/login', element: <GuestOnly><LoginPage /></GuestOnly> },
      { path: '/register', element: <GuestOnly><RegisterPage /></GuestOnly> },
      {
        path: '/',
        element: <RequireAuth><Shell /></RequireAuth>,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'customers', element: <Customers /> },
          { path: 'profile', element: <Customers /> },
          { path: 'accounts', element: <Accounts /> },
          { path: 'accounts/:accountId', element: <AccountDetail /> },
          { path: 'payments', element: <Payments /> },
          { path: 'deposits', element: <Deposits /> },
          { path: 'withdrawals', element: <Withdrawals /> },
          { path: 'transfers', element: <Transfers /> },
          { path: 'transactions', element: <Transactions /> },
          { path: 'transactions/:transactionId', element: <TransactionDetail /> },
          { path: 'statements', element: <Statements /> },
          { path: 'notifications', element: <Notifications /> },
          { path: 'security', element: <Security /> },
          { path: 'ledger', element: <LedgerHistory /> },
          {
            path: 'api-docs',
            element: (
              <div className="flex h-full items-center justify-center">
                <iframe
                  src="http://localhost:5000/api-docs"
                  className="h-full w-full border-0"
                  title="API Documentation"
                />
              </div>
            ),
          },
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
