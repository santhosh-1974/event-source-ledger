import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Transfers } from '../features/transfers/transfers';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiClient, ApiError } from '../lib/api-client';

vi.mock('../lib/api-client', () => ({
  apiClient: {
    transfer: vi.fn(),
    getAccounts: vi.fn(),
    getBalance: vi.fn(),
  },
  ApiError: class extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  },
}));

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  // Spy on invalidateQueries
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return { invalidateSpy };
};

const waitForAccounts = () =>
  waitFor(
    () =>
      expect(
        screen.getByRole('combobox', { name: /from account number/i }),
      ).toBeEnabled(),
    { timeout: 5000 },
  );

describe('Transfers component behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.getAccounts as any).mockResolvedValue({
      accounts: [
        { id: 'account-1', accountNumber: '1000000001', accountType: 'SAVINGS' },
        { id: 'account-2', accountNumber: '1000000002', accountType: 'SAVINGS' },
      ],
    });
  });

  it('shows confirmation step and cancels without API call', async () => {
    renderWithClient(<Transfers />);
    await waitForAccounts();
    // fill form
    fireEvent.change(screen.getByLabelText(/from account number/i), { target: { value: '1000000001' } });
    fireEvent.change(screen.getByLabelText(/to account number/i), { target: { value: '1000000002' } });
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '123.45' } });
    fireEvent.submit(screen.getByRole('button', { name: /transfer/i }));
    // confirmation appears
    await waitFor(() => expect(screen.getByRole('heading', { name: /confirm transfer/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    // modal disappears
    await waitFor(() => expect(screen.queryByRole('heading', { name: /confirm transfer/i })).not.toBeInTheDocument());
    expect(apiClient.transfer).not.toHaveBeenCalled();
  });

  it('confirms executes exactly one request and reuses idempotency key on retry', async () => {
    // first call rejects, second resolves
    const firstReject = new ApiError('Network error', 0);
    const resolved = { transactionId: 'tx123', reference: 'ref123' };
    (apiClient.transfer as any)
      .mockRejectedValueOnce(firstReject)
      .mockResolvedValueOnce(resolved);

    renderWithClient(<Transfers />);
    await waitForAccounts();
    // fill form
    fireEvent.change(screen.getByLabelText(/from account number/i), { target: { value: '1000000001' } });
    fireEvent.change(screen.getByLabelText(/to account number/i), { target: { value: '1000000002' } });
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '10.00' } });
    fireEvent.submit(screen.getByRole('button', { name: /transfer/i }));
    await waitFor(() => expect(screen.getByRole('heading', { name: /confirm transfer/i })).toBeInTheDocument());
    // first confirm (will reject)
    fireEvent.click(screen.getByRole('button', { name: /confirm transfer/i }));
    await waitFor(() => expect(apiClient.transfer).toHaveBeenCalledTimes(1));
    const firstKey = (apiClient.transfer as any).mock.calls[0][1];
    // simulate user retry by clicking confirm again
    fireEvent.click(screen.getByRole('button', { name: /confirm transfer/i }));
    await waitFor(() => expect(apiClient.transfer).toHaveBeenCalledTimes(2));
    const secondKey = (apiClient.transfer as any).mock.calls[1][1];
    expect(secondKey).toBe(firstKey);
    // after success UI should show success card
    await waitFor(() => expect(screen.getByText(/transfer successful/i)).toBeInTheDocument());
  });

  it('rejects invalid decimal amount before confirmation', async () => {
    renderWithClient(<Transfers />);
    await waitForAccounts();
    fireEvent.change(screen.getByLabelText(/from account number/i), { target: { value: '1000000001' } });
    fireEvent.change(screen.getByLabelText(/to account number/i), { target: { value: '1000000002' } });
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '-5' } });
    fireEvent.submit(screen.getByRole('button', { name: /transfer/i }));
    await waitFor(() => expect(screen.getByText(/invalid amount format/i)).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: /confirm transfer/i })).not.toBeInTheDocument();
    expect(apiClient.transfer).not.toHaveBeenCalled();
  });

  it('displays ownership error from API', async () => {
    const err = new ApiError('Ownership error', 403);
    (apiClient.transfer as any).mockRejectedValue(err);
    renderWithClient(<Transfers />);
    await waitForAccounts();
    fireEvent.change(screen.getByLabelText(/from account number/i), { target: { value: '1000000001' } });
    fireEvent.change(screen.getByLabelText(/to account number/i), { target: { value: '1000000002' } });
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '10' } });
    fireEvent.submit(screen.getByRole('button', { name: /transfer/i }));
    await waitFor(() => expect(screen.getByRole('heading', { name: /confirm transfer/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /confirm transfer/i }));
    await waitFor(() => expect(screen.getByText(/ownership error/i)).toBeInTheDocument());
    expect(apiClient.transfer).toHaveBeenCalled();
  });

  it('invalidates dashboard queries on successful transfer', async () => {
    const result = { transactionId: 'tx123', reference: 'ref123' };
    (apiClient.transfer as any).mockResolvedValue(result);
    const { invalidateSpy } = renderWithClient(<Transfers />);
    await waitForAccounts();
    fireEvent.change(screen.getByLabelText(/from account number/i), { target: { value: '1000000001' } });
    fireEvent.change(screen.getByLabelText(/to account number/i), { target: { value: '1000000002' } });
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '10' } });
    fireEvent.submit(screen.getByRole('button', { name: /transfer/i }));
    await waitFor(() => expect(screen.getByRole('heading', { name: /confirm transfer/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /confirm transfer/i }));
    await waitFor(() => expect(screen.getByText(/transfer successful/i)).toBeInTheDocument());
    // invalidateLedgerQueries() invalidates five keys after a successful transfer
    expect(invalidateSpy).toHaveBeenCalledTimes(5);
    for (const queryKey of [['accounts'], ['balance'], ['transactionHistory'], ['transactions'], ['dashboard']]) {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey });
    }
  });
});
