import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Plus, Loader2, Search, AlertCircle, ExternalLink } from 'lucide-react';
import { formatDate, formatAccountNumber } from '../../lib/formatters';
import { selectClassName } from '../../lib/utils';
import type { CreateAccountInput, AccountStatus } from '../../lib/types/api';

const statusColors: Record<AccountStatus, 'default' | 'secondary' | 'destructive' | 'success'> = {
  ACTIVE: 'success',
  BLOCKED: 'destructive',
  CLOSED: 'secondary',
};

export function Accounts() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  const { data: accountsData, isLoading, error } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiClient.getAccounts(),
  });

  const {
    data: customerData,
    error: customerError,
  } = useQuery({
    queryKey: ['customer-profile'],
    queryFn: () => apiClient.getCustomerProfile(),
  });

  const currentCustomer = customerData?.customer;

  const createMutation = useMutation({
    mutationFn: (data: CreateAccountInput) => apiClient.createAccount(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setShowCreateForm(false);
    },
  });

  const filteredAccounts = accountsData?.accounts?.filter(
    (account) =>
      account.accountNumber.includes(searchTerm) ||
      account.customerId.includes(searchTerm)
  ) || [];

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentCustomer) return;
    const formData = new FormData(e.currentTarget);
    const data: CreateAccountInput = {
      customerId: currentCustomer.id,
      accountNumber: String(formData.get('accountNumber') ?? '').trim(),
      accountType: formData.get('accountType') as 'SAVINGS' | 'CURRENT',
    };
    createMutation.mutate(data);
  };

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <span className="text-destructive">
            {error instanceof ApiError ? error.message : 'Failed to load accounts'}
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Accounts</h2>
          <p className="text-muted-foreground">Manage bank accounts</p>
        </div>
        <Button type="button" onClick={() => setShowCreateForm(!showCreateForm)}>
          <Plus className="mr-2 h-4 w-4" />
          {showCreateForm ? 'Cancel' : 'New Account'}
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Account</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label>Customer</Label>
                <Input value={currentCustomer ? `${currentCustomer.name} (${currentCustomer.email})` : 'Loading customer...'} disabled />
                {customerError && (
                  <p className="text-sm text-destructive">
                    {customerError instanceof ApiError
                      ? customerError.message
                      : 'Failed to load customer profile'}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  name="accountNumber"
                  placeholder="1000000001"
                  required
                  maxLength={20}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="accountType">Account Type</Label>
                <select
                  id="accountType"
                  name="accountType"
                  required
                  className={selectClassName}
                >
                  <option value="SAVINGS">Savings</option>
                  <option value="CURRENT">Current</option>
                </select>
              </div>
              {createMutation.error && (
                <div className="text-sm text-destructive">
                  {createMutation.error instanceof ApiError
                    ? createMutation.error.message
                    : 'Failed to create account'}
                </div>
              )}
              <Button type="submit" disabled={createMutation.isPending || !currentCustomer}>
                {createMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Create Account
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Accounts</CardTitle>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-[250px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No accounts found matching your search' : 'No accounts yet'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Customer ID</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">
                      {formatAccountNumber(account.accountNumber)}
                    </TableCell>
                    <TableCell>{account.accountType}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[account.status]}>
                        {account.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {account.customerId.slice(0, 8)}...
                    </TableCell>
                    <TableCell>{formatDate(String(account.createdAt))}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link to={`/accounts/${account.id}`} className="text-sm text-primary hover:underline">
                          Details
                        </Link>
                        <Link
                          to={`/ledger?account=${encodeURIComponent(account.accountNumber)}`}
                          className="inline-flex items-center"
                          aria-label={`Ledger for ${account.accountNumber}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
