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
  PaginationParams,
} from './types/api';

export const AUTH_UNAUTHORIZED_EVENT = 'ledger:unauthorized';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthError extends ApiError {
  constructor(message: string) {
    super(message, 401);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string) {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string) {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 409, details);
    this.name = 'ConflictError';
  }
}

export class ServerError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 500, details);
    this.name = 'ServerError';
  }
}

function apiOrigin(baseUrl: string): string {
  return baseUrl.replace(/\/api\/v1\/?$/, '');
}

function readErrorMessage(errorData: Record<string, unknown>, fallback: string): { message: string; details?: unknown } {
  const details = errorData.details ?? errorData.errors;
  const fieldErrors = Array.isArray(errorData.errors)
    ? errorData.errors
        .map((issue) => {
          if (issue && typeof issue === 'object' && 'message' in issue) {
            return String((issue as { message: unknown }).message);
          }
          return null;
        })
        .filter((message): message is string => Boolean(message))
    : [];

  const messageFromBody =
    (typeof errorData.message === 'string' && errorData.message) ||
    (typeof errorData.error === 'string' && errorData.error) ||
    fallback;

  return {
    message: fieldErrors.length > 0 && messageFromBody === 'Validation failed'
      ? fieldErrors.join('. ')
      : messageFromBody,
    details,
  };
}

function toApiError(status: number, message: string, details?: unknown): ApiError {
  switch (status) {
    case 400:
    case 422:
      return new ValidationError(message, details);
    case 401:
      return new AuthError(message);
    case 403:
      return new ForbiddenError(message);
    case 404:
      return new NotFoundError(message);
    case 409:
      return new ConflictError(message, details);
    default:
      return new ServerError(message, details);
  }
}

function unwrapData<T>(payload: unknown): T {
  if (
    payload &&
    typeof payload === 'object' &&
    'success' in payload &&
    (payload as { success: unknown }).success === true &&
    'data' in payload
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function asCustomerList(data: Customer | Customer[] | null | undefined): Customer[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

function asAccountList(data: BankAccount | BankAccount[] | null | undefined): BankAccount[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

class ApiClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    { skipAuthRedirect = false }: { skipAuthRedirect?: boolean } = {}
  ): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
    };

    if (options.headers) {
      const extra = new Headers(options.headers);
      extra.forEach((value, key) => {
        headers[key] = value;
      });
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const contentType = response.headers.get('content-type');
      const isJson = contentType?.includes('application/json');

      if (!response.ok) {
        let errorMessage = 'Request failed';
        let errorDetails: unknown;

        if (isJson) {
          const errorData = (await response.json()) as Record<string, unknown>;
          const parsed = readErrorMessage(errorData, errorMessage);
          errorMessage = parsed.message;
          errorDetails = parsed.details;
        }

        if (response.status === 401 && !skipAuthRedirect) {
          window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
        }

        throw toApiError(response.status, errorMessage, errorDetails);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      if (isJson) {
        return unwrapData<T>(await response.json());
      }

      return (await response.text()) as unknown as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof TypeError) {
        throw new ApiError('Network error: Unable to connect to the server', 0);
      }

      throw new ApiError('An unexpected error occurred', 500);
    }
  }

  async login(data: { email: string; password: string }): Promise<{ token: string }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }, { skipAuthRedirect: true });
  }

  async register(data: CreateCustomerInput & { password: string }): Promise<{ customer: Customer; token: string }> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }, { skipAuthRedirect: true });
  }

  async getCustomers(): Promise<{ customers: Customer[] }> {
    const data = await this.request<Customer | Customer[]>('/customers');
    return { customers: asCustomerList(data) };
  }

  async getCustomer(customerId: string): Promise<{ customer: Customer }> {
    const customer = await this.request<Customer>(`/customers/${customerId}`);
    return { customer };
  }

  async getAccounts(): Promise<{ accounts: BankAccount[] }> {
    const data = await this.request<BankAccount | BankAccount[]>('/accounts');
    return { accounts: asAccountList(data) };
  }

  async getAccount(accountId: string): Promise<{ account: BankAccount }> {
    const account = await this.request<BankAccount>(`/accounts/${accountId}`);
    return { account };
  }

  async createAccount(data: CreateAccountInput): Promise<{ account: BankAccount }> {
    const account = await this.request<BankAccount>('/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return { account };
  }

  async deposit(data: DepositInput, idempotencyKey: string): Promise<DepositResult> {
    return this.request('/banking/deposit', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(data),
    });
  }

  async withdraw(data: WithdrawInput, idempotencyKey: string): Promise<WithdrawResult> {
    return this.request('/banking/withdraw', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(data),
    });
  }

  async transfer(data: TransferInput, idempotencyKey: string): Promise<TransferResult> {
    return this.request('/banking/transfer', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(data),
    });
  }

  async getBalance(accountNumber: string, at?: string): Promise<AccountBalanceResult> {
    const queryParams = at ? `?at=${encodeURIComponent(at)}` : '';
    return this.request(`/banking/${encodeURIComponent(accountNumber)}/balance${queryParams}`);
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
    return this.request(
      `/banking/${encodeURIComponent(accountNumber)}/history${queryString ? `?${queryString}` : ''}`
    );
  }

  async getTransaction(transactionId: string): Promise<TransactionDetails> {
    return this.request(`/transactions/${encodeURIComponent(transactionId)}`);
  }

  async healthCheck(): Promise<{ status: string }> {
    return this.request(`${apiOrigin(this.baseUrl)}/health`, {}, { skipAuthRedirect: true });
  }
}

export const apiClient = new ApiClient();

const storedToken = localStorage.getItem('authToken');
if (storedToken) {
  apiClient.setAuthToken(storedToken);
}
