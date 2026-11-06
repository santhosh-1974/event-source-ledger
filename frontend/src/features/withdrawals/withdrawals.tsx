import React, { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../lib/api-client';
import { invalidateLedgerQueries } from '../../lib/query-client';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Loader2, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import { selectClassName } from '../../lib/utils';
import type { WithdrawInput } from '../../lib/types/api';
import { v4 as uuidv4 } from 'uuid';

const amountPattern = /^\d+(\.\d{1,2})?$/;

export function Withdrawals() {
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState<WithdrawInput>({
    accountNumber: searchParams.get('account') || '',
    amount: '',
  });
  const [result, setResult] = useState<{ transactionId: string; reference: string } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiClient.getAccounts(),
  });

  const withdrawMutation = useMutation({
    mutationFn: ({ data, idempotencyKey }: { data: WithdrawInput; idempotencyKey: string }) =>
      apiClient.withdraw(data, idempotencyKey),
    onSuccess: async (data) => {
      setResult(data);
      setValidationError(null);
      idempotencyKeyRef.current = null;
      setFormData((current) => ({ ...current, amount: '' }));
      await invalidateLedgerQueries(queryClient);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResult(null);
    if (!formData.accountNumber) {
      setValidationError('Account number is required');
      return;
    }
    if (!formData.amount) {
      setValidationError('Amount is required');
      return;
    }
    if (!amountPattern.test(formData.amount) || Number(formData.amount) <= 0) {
      setValidationError('Amount must be a positive number with up to 2 decimal places');
      return;
    }
    setValidationError(null);
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = uuidv4();
    }
    withdrawMutation.mutate({ data: formData, idempotencyKey: idempotencyKeyRef.current });
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  const accounts = accountsData?.accounts ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Withdrawals</h2>
        <p className="text-muted-foreground">Withdraw money from bank accounts</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>New Withdrawal</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="accountNumber">Account Number</Label>
              <select
                id="accountNumber"
                value={formData.accountNumber}
                onChange={(e) => {
                  idempotencyKeyRef.current = null;
                  setFormData({ ...formData, accountNumber: e.target.value });
                }}
                required
                disabled={accountsLoading || withdrawMutation.isPending}
                className={selectClassName}
              >
                <option value="">{accountsLoading ? 'Loading accounts...' : 'Select an account'}</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.accountNumber}>
                    {account.accountNumber} ({account.accountType})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={(e) => {
                  idempotencyKeyRef.current = null;
                  setFormData({ ...formData, amount: e.target.value });
                }}
                placeholder="500.00"
                required
                disabled={withdrawMutation.isPending}
              />
            </div>
            {validationError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {validationError}
              </div>
            )}
            {withdrawMutation.error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {withdrawMutation.error instanceof ApiError
                  ? withdrawMutation.error.message
                  : 'Failed to process withdrawal'}
              </div>
            )}
            <Button type="submit" disabled={withdrawMutation.isPending || accounts.length === 0} className="w-full">
              {withdrawMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Withdraw {formData.amount ? formatCurrency(formData.amount) : 'Amount'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card className="max-w-2xl border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-green-900 dark:text-green-100">Withdrawal Successful</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transaction ID:</span>
                <div className="flex items-center gap-2">
                  <code className="font-mono">{result.transactionId}</code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(result.transactionId)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reference:</span>
                <div className="flex items-center gap-2">
                  <code className="font-mono">{result.reference}</code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(result.reference)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
