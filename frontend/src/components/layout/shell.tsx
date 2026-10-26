import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './sidebar';
import { Header } from './header';

const pageTitles: Record<string, string> = {
  '/': 'Overview',
  '/customers': 'Customers',
  '/accounts': 'Accounts',
  '/deposits': 'Deposits',
  '/withdrawals': 'Withdrawals',
  '/transfers': 'Transfers',
  '/transactions': 'Transactions',
  '/ledger': 'Ledger History',
  '/api-docs': 'API Documentation',
};

export function Shell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'Dashboard';

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex flex-1 flex-col lg:ml-0">
        <Header onMenuClick={() => setSidebarOpen(true)} title={title} />

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
