import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Deposits } from '../features/deposits/deposits';

// Mock the API client
vi.mock('../lib/api-client', () => ({
  apiClient: {
    deposit: vi.fn(),
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

describe('Deposits Form', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const renderWithProviders = (component: any) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  it('should render deposit form', () => {
    renderWithProviders(<Deposits />);
    expect(screen.getByText('Deposits')).toBeInTheDocument();
    expect(screen.getByLabelText(/account number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
  });

  it('should require account number and amount', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Deposits />);

    const submitButton = screen.getByRole('button', { name: /deposit/i });
    await user.click(submitButton);

    // Form should have validation
    const accountInput = screen.getByLabelText(/account number/i);
    const amountInput = screen.getByLabelText(/amount/i);

    expect(accountInput).toHaveAttribute('required');
    expect(amountInput).toHaveAttribute('required');
  });

  it('should disable submit button while loading', async () => {
    const { apiClient } = await import('../lib/api-client');
    vi.mocked(apiClient.deposit).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const user = userEvent.setup();
    renderWithProviders(<Deposits />);

    const accountInput = screen.getByLabelText(/account number/i);
    const amountInput = screen.getByLabelText(/amount/i);
    const submitButton = screen.getByRole('button', { name: /deposit/i });

    await user.type(accountInput, '1000000001');
    await user.type(amountInput, '1000');
    await user.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });
});
