import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { formatAccountNumber, formatCurrency, formatDateTime } from '../../lib/formatters';

export function AccountDetail() {
  const { accountId } = useParams<{ accountId: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['accounts', accountId],
    queryFn: () => apiClient.getAccount(accountId!),
    enabled: !!accountId,
  });

  const account = data?.account;

  const { data: balanceData, isLoading: balanceLoading, error: balanceError } = useQuery({
    queryKey: ['balance', account?.accountNumber],
    queryFn: () => apiClient.getBalance(account!.accountNumber),
    enabled: !!account?.accountNumber,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['transactionHistory', account?.accountNumber, 1, 5],
    queryFn: () => apiClient.getTransactionHistory(account!.accountNumber, { page: 1, limit: 5 }),
    enabled: !!account?.accountNumber,
  });

  if (error) {
    return (
      <div className="space-y-6">
        <Link to="/accounts">
          <Button type="button" variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Accounts
          </Button>
        </Link>
        <Card>
          <CardContent className="flex items-center gap-2 p-6">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span className="text-destructive">
              {error instanceof ApiError ? error.message : 'Failed to load account'}
            </span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/accounts">
        <Button type="button" variant="ghost">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Accounts
        </Button>
      </Link>

      {isLoading || !account ? (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Account Number</div>
                  <div className="font-medium">{formatAccountNumber(account.accountNumber)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Type</div>
                  <div>{account.accountType}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge>{account.status}</Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Balance</div>
                  {balanceLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : balanceError ? (
                    <span className="text-sm text-destructive">Unable to load balance</span>
                  ) : (
                    <div className="text-2xl font-bold">{formatCurrency(balanceData?.balance ?? '0')}</div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={`/deposits?account=${encodeURIComponent(account.accountNumber)}`}>
                  <Button type="button" variant="outline">Deposit</Button>
                </Link>
                <Link to={`/withdrawals?account=${encodeURIComponent(account.accountNumber)}`}>
                  <Button type="button" variant="outline">Withdraw</Button>
                </Link>
                <Link to={`/ledger?account=${encodeURIComponent(account.accountNumber)}`}>
                  <Button type="button" variant="outline">Ledger History</Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !historyData || historyData.transactions.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No transactions yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData.transactions.map((txn, index) => (
                      <TableRow key={`${txn.transactionId}-${txn.entryType}-${index}`}>
                        <TableCell>
                          <Link to={`/transactions/${txn.transactionId}`} className="font-mono text-xs text-primary hover:underline">
                            {txn.reference}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={txn.entryType === 'CREDIT' ? 'success' : 'destructive'}>
                            {txn.entryType}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(txn.amount)}</TableCell>
                        <TableCell>{formatDateTime(txn.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
