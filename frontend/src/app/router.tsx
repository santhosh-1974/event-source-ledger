import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Shell } from '../components/layout/shell';
import { RequireAuth } from '../components/auth/RequireAuth';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { Dashboard } from '../features/dashboard/dashboard';
import { Customers } from '../features/customers/customers';
import { Accounts } from '../features/accounts/accounts';
import { Deposits } from '../features/deposits/deposits';
import { Withdrawals } from '../features/withdrawals/withdrawals';
import { Transfers } from '../features/transfers/transfers';
import { Transactions } from '../features/transactions/transactions';
import { TransactionDetail } from '../features/transactions/transaction-detail';
import { LedgerHistory } from '../features/ledger/ledger-history';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <RequireAuth><Dashboard /></RequireAuth> },
      { path: 'customers', element: <RequireAuth><Customers /></RequireAuth> },
      { path: 'accounts', element: <RequireAuth><Accounts /></RequireAuth> },
      { path: 'deposits', element: <RequireAuth><Deposits /></RequireAuth> },
      { path: 'withdrawals', element: <RequireAuth><Withdrawals /></RequireAuth> },
      { path: 'transfers', element: <RequireAuth><Transfers /></RequireAuth> },
      { path: 'transactions', element: <RequireAuth><Transactions /></RequireAuth> },
      { path: 'transactions/:transactionId', element: <RequireAuth><TransactionDetail /></RequireAuth> },
      { path: 'ledger', element: <RequireAuth><LedgerHistory /></RequireAuth> },
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
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
