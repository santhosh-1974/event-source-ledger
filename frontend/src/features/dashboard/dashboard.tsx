import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Users, Wallet, ArrowDownCircle, ArrowUpCircle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../lib/formatters';

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

  const accounts = accountsData?.accounts ?? [];

  const {
    data: balances,
    isLoading: balancesLoading,
    isError: balancesError,
  } = useQuery({
    queryKey: ['balance', 'dashboard', accounts.map((account) => account.accountNumber)],
    queryFn: async () => {
      const results = await Promise.allSettled(
        accounts.map((account) => api.banking.getBalance(account.accountNumber))
      );
      return results.map((result) => (result.status === 'fulfilled' ? Number(result.value.balance) : 0));
    },
    enabled: accounts.length > 0,
  });

  const totalBalance = (balances ?? []).reduce((sum, value) => sum + value, 0);
  const totalAccounts = accounts.length;
  const totalCustomers = customersData?.customers?.length ?? 0;
  const balanceLoading = accountsLoading || (accounts.length > 0 && balancesLoading);

  const stats = [
    {
      title: 'Total Balance',
      value: formatCurrency(totalBalance),
      testId: 'stat-value-balance',
      icon: Wallet,
      loading: balanceLoading,
      error: accountsError || balancesError,
    },
    {
      title: 'Total Accounts',
      value: totalAccounts,
      testId: 'stat-value-accounts',
      icon: Wallet,
      loading: accountsLoading,
      error: accountsError,
    },
    {
      title: 'Total Customers',
      value: totalCustomers,
      testId: 'stat-value-customers',
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
                  <div className="text-2xl font-bold" data-testid="stat-value">
                    <span data-testid={stat.testId}>{stat.value}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Link to="/deposits">
              <Button variant="outline">
                <ArrowDownCircle className="mr-2 h-4 w-4" />
                Deposit
              </Button>
            </Link>
            <Link to="/withdrawals">
              <Button variant="outline">
                <ArrowUpCircle className="mr-2 h-4 w-4" />
                Withdraw
              </Button>
            </Link>
            <Link to="/transfers">
              <Button variant="outline">Transfer</Button>
            </Link>
            <Link to="/accounts">
              <Button variant="outline">Accounts</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

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
