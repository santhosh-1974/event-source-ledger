import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Loader2, Search, AlertCircle, Clock, Info } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../../lib/formatters';
import { useSearchParams } from 'react-router-dom';

export function LedgerHistory() {
  const [searchParams] = useSearchParams();
  const [accountNumber, setAccountNumber] = useState(searchParams.get('account') || '');
  const [historicalDate, setHistoricalDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const { data: balanceData, isLoading: balanceLoading, error: balanceError } = useQuery({
    queryKey: ['balance', accountNumber, historicalDate],
    queryFn: () => apiClient.getBalance(accountNumber, historicalDate || undefined),
    enabled: !!accountNumber,
  });

  const { data: historyData, isLoading: historyLoading, error: historyError } = useQuery({
    queryKey: ['transactionHistory', accountNumber, page, limit],
    queryFn: () => apiClient.getTransactionHistory(accountNumber, { page, limit }),
    enabled: !!accountNumber,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const totalPages = historyData?.pagination?.totalPages || 0;

  if (balanceError || historyError) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <span className="text-destructive">
            {(balanceError || historyError) instanceof ApiError
              ? (balanceError || historyError)?.message
              : 'Failed to load ledger data'}
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Ledger History</h2>
        <p className="text-muted-foreground">
          View account balances and transaction history with event sourcing
        </p>
      </div>

      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="space-y-1 text-sm text-blue-900 dark:text-blue-100">
              <p className="font-semibold">About Event Sourcing</p>
              <p>
                This system uses event sourcing: every financial operation creates an immutable ledger entry.
                Balances are calculated by replaying these events, enabling accurate historical balance queries.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Search Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="accountNumber">Account Number</Label>
              <Input
                id="accountNumber"
                placeholder="1000000001"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="historicalDate">
                Historical Balance (Optional)
              </Label>
              <Input
                id="historicalDate"
                type="datetime-local"
                value={historicalDate}
                onChange={(e) => setHistoricalDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for current balance
              </p>
            </div>
            <Button type="submit" disabled={!accountNumber}>
              <Search className="mr-2 h-4 w-4" />
              View Balance & History
            </Button>
          </form>
        </CardContent>
      </Card>

      {accountNumber && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Account Balance
              </CardTitle>
              <CardDescription>
                {historicalDate ? `Historical balance as of ${new Date(historicalDate).toLocaleString()}` : 'Current balance'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {balanceLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : balanceData ? (
                <div className="space-y-4">
                  <div className="text-4xl font-bold">
                    {formatCurrency(balanceData.balance)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Account: {accountNumber}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Transaction History</CardTitle>
                {historyData && (
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({historyData.pagination.totalRecords} total)
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !historyData || historyData.transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No transactions found for this account
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyData.transactions.map((txn) => (
                        <TableRow key={txn.transactionId}>
                          <TableCell className="font-mono text-xs">
                            {txn.reference.slice(0, 8)}...
                          </TableCell>
                          <TableCell>
                            <Badge variant={txn.entryType === 'CREDIT' ? 'success' : 'destructive'}>
                              {txn.entryType}
                            </Badge>
                          </TableCell>
                          <TableCell className={txn.entryType === 'CREDIT' ? 'text-green-600' : 'text-red-600'}>
                            {txn.entryType === 'CREDIT' ? '+' : '-'}
                            {formatCurrency(txn.amount)}
                          </TableCell>
                          <TableCell>{txn.description || '-'}</TableCell>
                          <TableCell>{formatDateTime(txn.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <Button
                        variant="outline"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
