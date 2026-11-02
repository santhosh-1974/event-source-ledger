// Dashboard.tsx – professional banking dashboard
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api'; // centralized API client (handles JWT automatically)
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Users, Wallet, ArrowDownCircle, ArrowUpCircle, Loader2 } from 'lucide-react';

export function Dashboard() {
  const {
    data: customersData,
    isLoading: customersLoading,
    isError: customersError,
  } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.customers.getAll(),
  });

  const {
    data: accountsData,
    isLoading: accountsLoading,
    isError: accountsError,
  } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts.getAll(),
  });

  const totalBalance = accountsData?.accounts?.reduce((sum, acct) => sum + (acct.balance ?? 0), 0) ?? 0;
  const totalAccounts = accountsData?.accounts?.length ?? 0;
  const totalCustomers = customersData?.customers?.length ?? 0;

  const stats = [
    {
      title: 'Total Balance',
      value: `$${totalBalance.toFixed(2)}`,
      icon: Wallet,
      loading: accountsLoading,
      error: accountsError,
    },
    {
      title: 'Total Accounts',
      value: totalAccounts,
      icon: Wallet,
      loading: accountsLoading,
      error: accountsError,
    },
    {
      title: 'Total Customers',
      value: totalCustomers,
      icon: Users,
      loading: customersLoading,
      error: customersError,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Overview of your event-sourced ledger system</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {stat.loading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" data-testid="loader" />
                ) : stat.error ? (
                  <p className="text-sm text-red-600">Error loading data</p>
                ) : (
                  <div className="text-2xl font-bold" data-testid="stat-value">{stat.value}</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <a href="/deposits">
              <Button variant="outline">
                <ArrowDownCircle className="mr-2 h-4 w-4" />
                Deposit
              </Button>
            </a>
            <a href="/withdrawals">
              <Button variant="outline">
                <ArrowUpCircle className="mr-2 h-4 w-4" />
                Withdraw
              </Button>
            </a>
            <a href="/transfers">
              <Button variant="outline">Transfer</Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle>About Event Sourcing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>This system uses event sourcing to maintain a complete audit trail of all financial operations.</p>
          <p>Every deposit, withdrawal, and transfer creates immutable ledger entries rather than directly modifying balances.</p>
          <p>Balances are calculated by replaying these ledger events, ensuring complete traceability and enabling historical balance queries.</p>
        </CardContent>
      </Card>
    </div>
  );
}
