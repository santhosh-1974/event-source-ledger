import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import { Dashboard } from '../src/features/dashboard/dashboard';
import { api } from '../src/lib/api';

vi.mock('../src/lib/api', () => ({
  api: {
    customers: { getAll: vi.fn() },
    accounts: { getAll: vi.fn() },
    banking: { getBalance: vi.fn() },
    auth: { login: vi.fn(), register: vi.fn() },
    setAuthToken: vi.fn(),
  },
}));

test('renders loading state initially', () => {
  vi.mocked(api.customers.getAll).mockReturnValue(new Promise(() => {}));
  vi.mocked(api.accounts.getAll).mockReturnValue(new Promise(() => {}));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    </MemoryRouter>
  );
  // Dashboard has 3 stat cards; all show loaders while fetching
  expect(screen.getAllByTestId('loader').length).toBeGreaterThanOrEqual(2);
});

test('renders stats after successful fetch', async () => {
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
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    </MemoryRouter>
  );
  await waitFor(() => {
    expect(screen.getByTestId('stat-value-balance').textContent).toMatch(/300/);
  });
  const statValues = screen.getAllByTestId('stat-value').map((el) => el.textContent);
  expect(statValues.some((value) => value === '2')).toBe(true);
});
