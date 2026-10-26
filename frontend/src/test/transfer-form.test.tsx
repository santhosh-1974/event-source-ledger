import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Transfers } from '../features/transfers/transfers';

// Mock the API client
vi.mock('../lib/api-client', () => ({
  apiClient: {
    transfer: vi.fn(),
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

describe('Transfers Form', () => {
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

  it('should render transfer form', () => {
    renderWithProviders(<Transfers />);
    expect(screen.getByText('Transfers')).toBeInTheDocument();
    expect(screen.getByLabelText(/from account number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/to account number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
  });

  it('should require from account, to account, and amount', async () => {
    renderWithProviders(<Transfers />);

    const fromInput = screen.getByLabelText(/from account number/i);
    const toInput = screen.getByLabelText(/to account number/i);
    const amountInput = screen.getByLabelText(/amount/i);

    expect(fromInput).toHaveAttribute('required');
    expect(toInput).toHaveAttribute('required');
    expect(amountInput).toHaveAttribute('required');
  });

  it('should allow optional description', () => {
    renderWithProviders(<Transfers />);
    const descriptionInput = screen.getByLabelText(/description/i);
    expect(descriptionInput).not.toHaveAttribute('required');
  });
});
