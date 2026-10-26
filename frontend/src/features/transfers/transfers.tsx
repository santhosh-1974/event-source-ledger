import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../lib/api-client';
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

  const transferMutation = useMutation({
    mutationFn: ({ data, idempotencyKey }: { data: TransferInput; idempotencyKey: string }) =>
      apiClient.transfer(data, idempotencyKey),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResult(null);

    if (formData.fromAccountNumber === formData.toAccountNumber) {
      alert('Source and destination accounts must be different');
      return;
    }

    const idempotencyKey = uuidv4();
    transferMutation.mutate({ data: formData, idempotencyKey });
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
            {transferMutation.error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {transferMutation.error instanceof ApiError
                  ? transferMutation.error.message
                  : 'Failed to process transfer'}
              </div>
            )}
            <Button type="submit" disabled={transferMutation.isPending} className="w-full">
              {transferMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Transfer {formData.amount ? formatCurrency(formData.amount) : 'Amount'}
            </Button>
          </form>
        </CardContent>
      </Card>

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
                  <Button
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
