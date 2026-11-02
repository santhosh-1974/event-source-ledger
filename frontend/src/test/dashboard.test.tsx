import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Dashboard } from '../../features/dashboard/dashboard';
import * as api from '../../lib/api';

jest.mock('../../lib/api', () => ({
  api: {
    customers: { getAll: jest.fn() },
    accounts: { getAll: jest.fn() },
    auth: { login: jest.fn(), register: jest.fn() },
    setAuthToken: jest.fn(),
  },
}));

test('renders loading state initially', async () => {
  (api.api.customers.getAll as jest.Mock).mockReturnValue(new Promise(() => {}));
  (api.api.accounts.getAll as jest.Mock).mockReturnValue(new Promise(() => {}));
  const queryClient = new QueryClient();
  render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    </BrowserRouter>
  );
  // Expect two loader spinners (balance and accounts)
  expect(screen.getAllByTestId('loader')).toHaveLength(2);
});

test('renders stats after successful fetch', async () => {
  (api.api.customers.getAll as jest.Mock).mockResolvedValue({ customers: [{ id: 'c1' }, { id: 'c2' }] });
  (api.api.accounts.getAll as jest.Mock).mockResolvedValue({
    accounts: [
      { id: 'a1', balance: 100 },
      { id: 'a2', balance: 200 },
    ],
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    </BrowserRouter>
  );
  await waitFor(() => {
    expect(screen.getByText('$300.00')).toBeInTheDocument();
    const statValues = screen.getAllByTestId('stat-value').map((el) => el.textContent);
    expect(statValues).toContain('2'); // accounts count
    expect(statValues).toContain('2'); // customers count
  });
});
