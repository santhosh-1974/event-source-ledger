import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Shell } from '../components/layout/shell';
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
      { index: true, element: <Dashboard /> },
      { path: 'customers', element: <Customers /> },
      { path: 'accounts', element: <Accounts /> },
      { path: 'deposits', element: <Deposits /> },
      { path: 'withdrawals', element: <Withdrawals /> },
      { path: 'transfers', element: <Transfers /> },
      { path: 'transactions', element: <Transactions /> },
      { path: 'transactions/:transactionId', element: <TransactionDetail /> },
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
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
