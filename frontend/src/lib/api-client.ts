import { API_BASE_URL } from './config';
import type {
  Customer,
  CreateCustomerInput,
  BankAccount,
  CreateAccountInput,
  DepositInput,
  DepositResult,
  WithdrawInput,
  WithdrawResult,
  TransferInput,
  TransferResult,
  AccountBalanceResult,
  TransactionHistoryResult,
  TransactionDetails,
  UpdateAccountStatusInput,
  PaginationParams,
} from './types/api';

class ApiError extends Error {
  status: number;
  details?: any;

  constructor(
    message: string,
    status: number,
    details?: any
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const contentType = response.headers.get('content-type');
      const isJson = contentType?.includes('application/json');

      if (!response.ok) {
        let errorMessage = 'Request failed';
        let errorDetails;

        if (isJson) {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
          errorDetails = errorData.details;
        }

        throw new ApiError(errorMessage, response.status, errorDetails);
      }

      if (isJson) {
        return await response.json();
      }

      return (await response.text()) as unknown as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ApiError('Network error: Unable to connect to the server', 0);
      }

      throw new ApiError('An unexpected error occurred', 500);
    }
  }

  // Customers
  async getCustomers(): Promise<{ customers: Customer[] }> {
    return this.request('/customers');
  }

  async getCustomer(customerId: string): Promise<{ customer: Customer }> {
    return this.request(`/customers/${customerId}`);
  }

  async createCustomer(data: CreateCustomerInput): Promise<{ customer: Customer }> {
    return this.request('/customers/create-customer', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Accounts
  async getAccounts(): Promise<{ accounts: BankAccount[] }> {
    return this.request('/accounts');
  }

  async getAccount(accountId: string): Promise<{ account: BankAccount }> {
    return this.request(`/accounts/${accountId}`);
  }

  async createAccount(data: CreateAccountInput): Promise<{ account: BankAccount }> {
    return this.request('/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAccountStatus(
    accountNumber: string,
    data: UpdateAccountStatusInput
  ): Promise<{ account: BankAccount }> {
    return this.request(`/accounts/${accountNumber}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Banking
  async deposit(
    data: DepositInput,
    idempotencyKey: string
  ): Promise<DepositResult> {
    const result = await this.request<{ success: true; data: DepositResult }>(
      '/banking/deposit',
      {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(data),
      }
    );
    return result.data;
  }

  async withdraw(
    data: WithdrawInput,
    idempotencyKey: string
  ): Promise<WithdrawResult> {
    const result = await this.request<{ success: true; data: WithdrawResult }>(
      '/banking/withdraw',
      {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(data),
      }
    );
    return result.data;
  }

  async transfer(
    data: TransferInput,
    idempotencyKey: string
  ): Promise<TransferResult> {
    const result = await this.request<{ success: true; data: TransferResult }>(
      '/banking/transfer',
      {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(data),
      }
    );
    return result.data;
  }

  async getBalance(
    accountNumber: string,
    at?: string
  ): Promise<AccountBalanceResult> {
    const queryParams = at ? `?at=${encodeURIComponent(at)}` : '';
    const result = await this.request<{ success: true; data: AccountBalanceResult }>(
      `/banking/${accountNumber}/balance${queryParams}`
    );
    return result.data;
  }

  async getTransactionHistory(
    accountNumber: string,
    params: PaginationParams = {}
  ): Promise<TransactionHistoryResult> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.sort) queryParams.append('sort', params.sort);

    const queryString = queryParams.toString();
    const result = await this.request<{ success: true; data: TransactionHistoryResult }>(
      `/banking/${accountNumber}/history${queryString ? `?${queryString}` : ''}`
    );
    return result.data;
  }

  // Transactions
  async getTransaction(transactionId: string): Promise<TransactionDetails> {
    const result = await this.request<{ success: true; data: TransactionDetails }>(
      `/transactions/${transactionId}`
    );
    return result.data;
  }

  // Health
  async healthCheck(): Promise<{ status: string }> {
    return this.request('/health');
  }
}

export const apiClient = new ApiClient();
export { ApiError };
