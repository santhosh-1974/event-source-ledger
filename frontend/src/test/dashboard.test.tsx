import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../features/dashboard/dashboard';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    customers: { getAll: vi.fn() },
    accounts: { getAll: vi.fn() },
    banking: { getBalance: vi.fn() },
    auth: { login: vi.fn(), register: vi.fn() },
    setAuthToken: vi.fn(),
  },
}));

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(api.customers.getAll).mockReturnValue(new Promise(() => {}));
    vi.mocked(api.accounts.getAll).mockReturnValue(new Promise(() => {}));
    renderDashboard();
    expect(screen.getAllByTestId('loader')).toHaveLength(2);
  });

  it('renders stats after successful fetch', async () => {
    vi.mocked(api.customers.getAll).mockResolvedValue({ customers: [{ id: 'c1' }, { id: 'c2' }] } as never);
    vi.mocked(api.accounts.getAll).mockResolvedValue({
      accounts: [
        { id: 'a1', accountNumber: 'A1' },
        { id: 'a2', accountNumber: 'A2' },
      ],
    } as never);
    vi.mocked(api.banking.getBalance).mockImplementation(async (accountNumber: string) => ({
      accountNumber,
      balance: accountNumber === 'A1' ? '100.00' : '200.00',
    }));

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('stat-value-balance').textContent).toMatch(/300/);
    });
    expect(screen.getByTestId('stat-value-accounts').textContent).toBe('2');
    expect(screen.getByTestId('stat-value-customers').textContent).toBe('2');
  });

  it('shows error messages when API fails', async () => {
    vi.mocked(api.customers.getAll).mockRejectedValue(new Error('Failed'));
    vi.mocked(api.accounts.getAll).mockRejectedValue(new Error('Failed'));
    renderDashboard();
    await waitFor(() => {
      expect(screen.getAllByText('Error loading data').length).toBeGreaterThanOrEqual(2);
    });
  });
});
