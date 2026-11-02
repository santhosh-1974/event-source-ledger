// Focused tests for Dashboard component
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Dashboard } from './dashboard';

// Mock the centralized API client
jest.mock('../../lib/api', () => ({
  api: {
    customers: {
      getAll: jest.fn(),
    },
    accounts: {
      getAll: jest.fn(),
    },
  },
}));

const mockedApi = require('../../lib/api').api;

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    </BrowserRouter>
  );
}

describe('Dashboard', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test('shows loading spinners while fetching', async () => {
    // Return pending promises to keep loading state
    mockedApi.customers.getAll.mockReturnValue(new Promise(() => {}));
    mockedApi.accounts.getAll.mockReturnValue(new Promise(() => {}));

    renderWithProviders();
    // Expect loaders to be in document
    expect(screen.getAllByTestId('loader')).toHaveLength(2);
  });

  test('renders stats when data is loaded', async () => {
    mockedApi.customers.getAll.mockResolvedValue({ customers: [{ id: 'c1' }, { id: 'c2' }] });
    mockedApi.accounts.getAll.mockResolvedValue({
      accounts: [
        { accountNumber: 'A1', balance: 100 },
        { accountNumber: 'A2', balance: 200 },
      ],
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Total Balance')).toBeInTheDocument();
    });
    expect(screen.getByText('$300.00')).toBeInTheDocument();
    expect(screen.getByText('Total Accounts')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Total Customers')).toBeInTheDocument();
    expect(screen.getAllByText('2')).toHaveLength(2); // accounts & customers
  });

  test('shows error messages when API fails', async () => {
    mockedApi.customers.getAll.mockRejectedValue(new Error('Failed'));
    mockedApi.accounts.getAll.mockRejectedValue(new Error('Failed'));

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getAllByText('Error loading data')).toHaveLength(2);
    });
  });
});
