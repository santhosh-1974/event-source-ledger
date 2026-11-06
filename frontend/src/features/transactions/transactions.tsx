import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Loader2, Search, AlertCircle, ExternalLink } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../../lib/formatters';
import { selectClassName } from '../../lib/utils';

export function Transactions() {
  const [accountNumber, setAccountNumber] = useState('');
  const [submittedAccount, setSubmittedAccount] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiClient.getAccounts(),
  });

  const { data: historyData, isLoading, error } = useQuery({
    queryKey: ['transactionHistory', submittedAccount, page, limit],
    queryFn: () => apiClient.getTransactionHistory(submittedAccount, { page, limit }),
    enabled: !!submittedAccount,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedAccount(accountNumber.trim());
    setPage(1);
  };

  const totalPages = historyData?.pagination?.totalPages || 0;
  const accounts = accountsData?.accounts ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Transactions</h2>
        <p className="text-muted-foreground">View transaction history for accounts</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                list="transaction-accounts"
                placeholder="Enter account number..."
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className={`${selectClassName} pl-8`}
              />
              <datalist id="transaction-accounts">
                {accounts.map((account) => (
                  <option key={account.id} value={account.accountNumber} />
                ))}
              </datalist>
            </div>
            <Button type="submit" disabled={!accountNumber}>
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="flex items-center gap-2 p-6">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span className="text-destructive">
              {error instanceof ApiError ? error.message : 'Failed to load transactions'}
            </span>
          </CardContent>
        </Card>
      )}

      {submittedAccount && !error && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Transaction History</CardTitle>
              {historyData && (
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages || 1} ({historyData.pagination.totalRecords} total)
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" data-testid="loading-spinner" />
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
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData.transactions.map((txn, index) => (
                      <TableRow key={`${txn.transactionId}-${txn.entryType}-${index}`}>
                        <TableCell className="font-mono text-xs">
                          {txn.reference}
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
                        <TableCell>
                          <Link to={`/transactions/${txn.transactionId}`}>
                            <Button type="button" variant="ghost" size="sm" aria-label="View transaction">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex items-center justify-between mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages || 1}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPage((p) => Math.min(Math.max(totalPages, 1), p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
