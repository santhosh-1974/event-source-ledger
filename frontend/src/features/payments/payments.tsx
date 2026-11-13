import { useQuery } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowRightLeft, ArrowUpCircle, CreditCard, ShieldCheck, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { api } from '../../lib/api';

export function Payments() {
  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts.getAll(),
  });

  const accountCount = accountsData?.accounts?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Payments</h2>
        <p className="text-muted-foreground">
          Move funds with secure, audited payment flows.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Accounts</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '…' : accountCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Audit Trail</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Immutable</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Protected</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Live</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick payment actions</CardTitle>
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
              <Button variant="outline">
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Transfer
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
