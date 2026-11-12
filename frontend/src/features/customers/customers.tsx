import { useQuery } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Loader2, AlertCircle } from 'lucide-react';
import { formatDate } from '../../lib/formatters';

export function Customers() {
  const { data: customerData, isLoading, error } = useQuery({
    queryKey: ['customer-profile'],
    queryFn: () => apiClient.getCustomerProfile(),
  });
  const customer = customerData?.customer;

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <span className="text-destructive">
            {error instanceof ApiError ? error.message : 'Failed to load customers'}
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Customer Profile</h2>
        <p className="text-muted-foreground">
          Your customer profile. New customers are created through registration.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !customer ? (
            <div className="text-center py-8 text-muted-foreground">
              No customer profile found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.email}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell>{formatDate(customer.createdAt)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
