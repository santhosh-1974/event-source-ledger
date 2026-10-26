import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../../lib/formatters';

export function TransactionDetail() {
  const { transactionId } = useParams<{ transactionId: string }>();

  const { data: transaction, isLoading, error } = useQuery({
    queryKey: ['transaction', transactionId],
    queryFn: () => apiClient.getTransaction(transactionId!),
    enabled: !!transactionId,
  });

  if (error) {
    return (
      <div className="space-y-6">
        <Link to="/transactions">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Transactions
          </Button>
        </Link>
        <Card>
          <CardContent className="flex items-center gap-2 p-6">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span className="text-destructive">
              {error instanceof ApiError ? error.message : 'Failed to load transaction'}
            </span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/transactions">
        <Button variant="ghost">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Transactions
        </Button>
      </Link>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : transaction ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Transaction Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Transaction ID</div>
                  <div className="font-mono text-sm">{transaction.transactionId}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Reference</div>
                  <div className="font-mono text-sm">{transaction.reference}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Type</div>
                  <div>{transaction.type || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Created At</div>
                  <div>{formatDateTime(transaction.createdAt)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ledger Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entry Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Ledger Account</TableHead>
                    <TableHead>Bank Account</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transaction.entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Badge variant={entry.entryType === 'CREDIT' ? 'success' : 'destructive'}>
                          {entry.entryType}
                        </Badge>
                      </TableCell>
                      <TableCell className={entry.entryType === 'CREDIT' ? 'text-green-600' : 'text-red-600'}>
                        {entry.entryType === 'CREDIT' ? '+' : '-'}
                        {formatCurrency(entry.amount)}
                      </TableCell>
                      <TableCell>{entry.ledgerAccountName}</TableCell>
                      <TableCell>{entry.bankAccountId || 'N/A'}</TableCell>
                      <TableCell>{formatDateTime(entry.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {transaction.debitEntries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Debit Entries</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ledger Account</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transaction.debitEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.ledgerAccountName}</TableCell>
                        <TableCell className="text-red-600">
                          {formatCurrency(entry.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {transaction.creditEntries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Credit Entries</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ledger Account</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transaction.creditEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.ledgerAccountName}</TableCell>
                        <TableCell className="text-green-600">
                          {formatCurrency(entry.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
