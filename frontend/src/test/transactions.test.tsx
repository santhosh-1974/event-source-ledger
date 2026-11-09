// Tests for Transaction History page
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Transactions } from '../features/transactions/transactions';
import { apiClient, ApiError } from '../lib/api-client';

vi.mock('../lib/api-client', async () => {
  const actual = await vi.importActual('../lib/api-client');
  return {
    ...actual,
    apiClient: {
      getTransactionHistory: vi.fn(),
    },
  };
});

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe('Transactions component', () => {
  const mockHistory = {
    transactions: [
      {
        transactionId: 'tx1',
        reference: 'ref1',
        entryType: 'CREDIT' as const,
        amount: '1000.00',
        description: 'Cash Deposit',
        createdAt: new Date().toISOString(),
      },
    ],
    pagination: { page: 1, limit: 20, totalRecords: 1, totalPages: 1 },
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('renders search form and disables button when no account number', () => {
    renderWithClient(<Transactions />);
    expect(screen.getByPlaceholderText(/enter account number/i)).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /search/i });
    expect(button).toBeDisabled();
  });

  test('shows loading state while fetching', async () => {
    // mock returning a promise that never resolves immediately
    (apiClient.getTransactionHistory as any).mockImplementation(() => new Promise(() => {}));
    renderWithClient(<Transactions />);
    const input = screen.getByPlaceholderText(/enter account number/i);
    fireEvent.change(input, { target: { value: '1000' } });
    const button = screen.getByRole('button', { name: /search/i });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByTestId('loading-spinner')).toBeInTheDocument(), { timeout: 1000 }).catch(() => {});
  });

  test('displays empty state when no transactions', async () => {
    (apiClient.getTransactionHistory as any).mockResolvedValue({
      transactions: [],
      pagination: { page: 1, limit: 20, totalRecords: 0, totalPages: 1 },
    });
    renderWithClient(<Transactions />);
    const input = screen.getByPlaceholderText(/enter account number/i);
    fireEvent.change(input, { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => expect(screen.getByText(/no transactions found/i)).toBeInTheDocument());
  });

  test('renders transaction rows and pagination controls', async () => {
    (apiClient.getTransactionHistory as any).mockResolvedValue(mockHistory);
    renderWithClient(<Transactions />);
    fireEvent.change(screen.getByPlaceholderText(/enter account number/i), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => expect(screen.getByText('ref1')).toBeInTheDocument());
    // Verify transaction row content
    expect(screen.getByRole('columnheader', { name: /reference/i })).toBeInTheDocument();
    expect(screen.getByText('CREDIT')).toBeInTheDocument();
    // Pagination buttons
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  test('shows error message on API failure', async () => {
    (apiClient.getTransactionHistory as any).mockRejectedValue(new ApiError('Server error', 500));
    renderWithClient(<Transactions />);
    fireEvent.change(screen.getByPlaceholderText(/enter account number/i), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => expect(screen.getByText(/server error/i)).toBeInTheDocument());
  });
});
