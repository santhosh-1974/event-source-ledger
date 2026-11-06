import React, { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../lib/api-client';
import { invalidateLedgerQueries } from '../../lib/query-client';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Loader2, CheckCircle, AlertCircle, Copy, ArrowRightLeft } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import { selectClassName } from '../../lib/utils';
import type { TransferInput } from '../../lib/types/api';
import { v4 as uuidv4 } from 'uuid';

const amountRegex = /^\d+(\.\d{1,2})?$/;

export function Transfers() {
  const [formData, setFormData] = useState<TransferInput>({
    fromAccountNumber: '',
    toAccountNumber: '',
    amount: '',
    description: '',
  });
  const [result, setResult] = useState<{ transactionId: string; reference: string } | null>(null);
  const queryClient = useQueryClient();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiClient.getAccounts(),
  });

  const transferMutation = useMutation({
    mutationFn: ({ data, idempotencyKey: key }: { data: TransferInput; idempotencyKey: string }) =>
      apiClient.transfer(data, key),
    onSuccess: async (data) => {
      setResult(data);
      setValidationError(null);
      idempotencyKeyRef.current = null;
      setIdempotencyKey(null);
      setShowConfirm(false);
      setFormData((current) => ({ ...current, amount: '', description: '' }));
      await invalidateLedgerQueries(queryClient);
    },
  });

  const ensureIdempotencyKey = () => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = uuidv4();
      setIdempotencyKey(idempotencyKeyRef.current);
    }
    return idempotencyKeyRef.current;
  };

  const updateField = <K extends keyof TransferInput>(field: K, value: TransferInput[K]) => {
    idempotencyKeyRef.current = null;
    setIdempotencyKey(null);
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResult(null);
    if (!formData.fromAccountNumber) {
      setValidationError('Source account number is required');
      return;
    }
    if (!formData.toAccountNumber) {
      setValidationError('Destination account number is required');
      return;
    }
    if (formData.fromAccountNumber === formData.toAccountNumber) {
      setValidationError('Source and destination accounts must be different');
      return;
    }
    if (!formData.amount) {
      setValidationError('Amount is required');
      return;
    }
    if (!amountRegex.test(formData.amount) || Number(formData.amount) <= 0) {
      setValidationError('Invalid amount format');
      return;
    }
    setValidationError(null);
    ensureIdempotencyKey();
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    const key = ensureIdempotencyKey();
    transferMutation.mutate({ data: formData, idempotencyKey: key });
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  const accounts = accountsData?.accounts ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Transfers</h2>
        <p className="text-muted-foreground">Transfer money between accounts</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>New Transfer</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="fromAccountNumber">From Account Number</Label>
              <select
                id="fromAccountNumber"
                value={formData.fromAccountNumber}
                onChange={(e) => updateField('fromAccountNumber', e.target.value)}
                required
                disabled={accountsLoading || transferMutation.isPending}
                className={selectClassName}
              >
                <option value="">{accountsLoading ? 'Loading accounts...' : 'Select source account'}</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.accountNumber}>
                    {account.accountNumber} ({account.accountType})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-center">
              <ArrowRightLeft className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="toAccountNumber">To Account Number</Label>
              <select
                id="toAccountNumber"
                value={formData.toAccountNumber}
                onChange={(e) => updateField('toAccountNumber', e.target.value)}
                required
                disabled={accountsLoading || transferMutation.isPending}
                className={selectClassName}
              >
                <option value="">{accountsLoading ? 'Loading accounts...' : 'Select destination account'}</option>
                {accounts.map((account) => (
                  <option key={`to-${account.id}`} value={account.accountNumber}>
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
                onChange={(e) => updateField('amount', e.target.value)}
                placeholder="1000.00"
                required
                disabled={transferMutation.isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={formData.description || ''}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Payment for services"
                maxLength={255}
                disabled={transferMutation.isPending}
              />
            </div>
            {validationError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {validationError}
              </div>
            )}
            {transferMutation.error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {transferMutation.error instanceof ApiError ? transferMutation.error.message : 'Failed to process transfer'}
              </div>
            )}
            <Button type="submit" disabled={transferMutation.isPending || accounts.length < 2} className="w-full">
              {transferMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Transfer {formData.amount ? formatCurrency(formData.amount) : 'Amount'}
            </Button>
            {accounts.length < 2 && !accountsLoading && (
              <p className="text-sm text-muted-foreground">You need at least two accounts to transfer.</p>
            )}
          </form>
        </CardContent>
      </Card>

      {showConfirm && (
        <Card className="max-w-2xl border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle>Confirm Transfer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <strong>From:</strong> {formData.fromAccountNumber}
            </div>
            <div>
              <strong>To:</strong> {formData.toAccountNumber}
            </div>
            <div>
              <strong>Amount:</strong> {formatCurrency(formData.amount)}
            </div>
            {formData.description && (
              <div>
                <strong>Description:</strong> {formData.description}
              </div>
            )}
            {idempotencyKey && (
              <p className="text-xs text-muted-foreground">Retries reuse the same idempotency key.</p>
            )}
            <div className="flex space-x-2">
              <Button type="button" variant="outline" onClick={handleCancel} disabled={transferMutation.isPending}>
                Cancel
              </Button>
              <Button type="button" onClick={handleConfirm} disabled={transferMutation.isPending}>
                {transferMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm Transfer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="max-w-2xl border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-green-900 dark:text-green-100">Transfer Successful</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transaction ID:</span>
                <div className="flex items-center gap-2">
                  <code className="font-mono">{result.transactionId}</code>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(result.transactionId)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reference:</span>
                <div className="flex items-center gap-2">
                  <code className="font-mono">{result.reference}</code>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(result.reference)}>
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
