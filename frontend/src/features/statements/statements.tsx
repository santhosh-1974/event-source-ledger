import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Download, Loader2 } from 'lucide-react';

import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/formatters';

function getDefaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function Statements() {
  const defaults = useMemo(() => getDefaultRange(), []);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);

  const { data: accountData, isLoading: loadingAccounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts.getAll(),
  });

  const accounts = accountData?.accounts ?? [];

  const { data: statementData, isLoading: loadingStatement, error } = useQuery({
    queryKey: ['statement', selectedAccount, from, to],
    queryFn: () => api.reports.getStatement(selectedAccount, from, to),
    enabled: Boolean(selectedAccount && from && to),
  });

  const handleDownload = async () => {
    if (!selectedAccount) return;
    const csv = await api.reports.downloadCsv(selectedAccount, from, to);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `statement-${selectedAccount.slice(-4)}-${from}-${to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Statements</h2>
        <p className="text-muted-foreground">
          Review ledger-derived account activity and download CSV exports.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Statement filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Account</label>
              <select
                value={selectedAccount}
                onChange={(event) => setSelectedAccount(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.accountNumber}>
                    {account.accountNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">From</label>
              <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">To</label>
              <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={handleDownload} disabled={!selectedAccount}>
              <Download className="mr-2 h-4 w-4" />
              Download CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {loadingAccounts ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {error ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{error instanceof Error ? error.message : 'Failed to load statement'}</span>
          </CardContent>
        </Card>
      ) : null}

      {loadingStatement ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {statementData ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Opening Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{formatCurrency(statementData.openingBalance ?? '0')}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Debits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-red-600">{formatCurrency(statementData.totalDebits ?? '0')}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Credits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-green-600">{formatCurrency(statementData.totalCredits ?? '0')}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Closing Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{formatCurrency(statementData.closingBalance ?? '0')}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Statement entries</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(statementData.entries ?? []).map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.createdAt)}</TableCell>
                      <TableCell>{entry.description ?? 'Ledger movement'}</TableCell>
                      <TableCell>{entry.entryType}</TableCell>
                      <TableCell className={entry.entryType === 'DEBIT' ? 'text-red-600' : 'text-green-600'}>
                        {formatCurrency(entry.amount ?? '0')}
                      </TableCell>
                      <TableCell>{formatCurrency(entry.runningBalance ?? '0')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
