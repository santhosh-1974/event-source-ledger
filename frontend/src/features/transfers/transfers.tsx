import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Loader2, CheckCircle, AlertCircle, Copy, ArrowRightLeft } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { TransferInput } from '../../lib/types/api';
import { v4 as uuidv4 } from 'uuid';

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

  const transferMutation = useMutation({
    mutationFn: ({ data, idempotencyKey }: { data: TransferInput; idempotencyKey: string }) =>
      api.transfer(data, idempotencyKey),
    onSuccess: (data) => {
      setResult(data);
      setValidationError(null);
      setIdempotencyKey(null);
      setShowConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: () => {
      // ensure validation error does not persist on server error
      setValidationError(null);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResult(null);
    // client‑side validation
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
    // Validate amount as decimal string (up to 2 decimal places, > 0)
    const amountRegex = /^\d+(\.\d{1,2})?$/;
    if (!amountRegex.test(formData.amount) || Number(formData.amount) <= 0) {
      setValidationError('Invalid amount format');
      return;
    }
    setValidationError(null);
    // generate idempotency key for this attempt if not already set
    if (!idempotencyKey) {
      setIdempotencyKey(uuidv4());
    }
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    if (!idempotencyKey) return;
    transferMutation.mutate({ data: formData, idempotencyKey });
    // UI will be updated in onSuccess / onError
  };

  const handleCancel = () => {
    // keep the idempotency key so a retry reuses it
    setShowConfirm(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

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
              <Input
                id="fromAccountNumber"
                value={formData.fromAccountNumber}
                onChange={(e) => setFormData({ ...formData, fromAccountNumber: e.target.value })}
                placeholder="1000000001"
                required
                maxLength={20}
              />
            </div>
            <div className="flex justify-center">
              <ArrowRightLeft className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="toAccountNumber">To Account Number</Label>
              <Input
                id="toAccountNumber"
                value={formData.toAccountNumber}
                onChange={(e) => setFormData({ ...formData, toAccountNumber: e.target.value })}
                placeholder="1000000002"
                required
                maxLength={20}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="1000.00"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Payment for services"
                maxLength={255}
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
            <Button type="submit" disabled={transferMutation.isPending} className="w-full">
              {transferMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Transfer {formData.amount ? formatCurrency(formData.amount) : 'Amount'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Confirmation Step */}
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
            <div className="flex space-x-2">
              <Button variant="outline" onClick={handleCancel} disabled={transferMutation.isPending}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={transferMutation.isPending}>
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
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(result.transactionId)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reference:</span>
                <div className="flex items-center gap-2">
                  <code className="font-mono">{result.reference}</code>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(result.reference)}>
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
