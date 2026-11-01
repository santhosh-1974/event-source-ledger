// Centralized API client
import { API_BASE_URL } from './config';
import type {
  CreateCustomerInput,
  DepositInput,
  WithdrawInput,
  TransferInput,
  CreateAccountInput,
  UpdateAccountStatusInput,
  PaginationParams,
} from './types/api';

/**
 * Typed error hierarchy for API failures.
 */
export class ApiError extends Error {
  constructor(public message: string, public status: number, public details?: any) {
    super(message);
    this.name = 'ApiError';
  }
}
export class ValidationError extends ApiError {
  constructor(message: string, details?: any) {
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
export class ServerError extends ApiError {
  constructor(message: string, details?: any) {
    super(message, 500, details);
    this.name = 'ServerError';
  }
}

let authToken: string | null = null;
/**
 * Setter used by AuthContext to keep the client in sync.
 */
export const setAuthToken = (token: string | null) => {
  authToken = token;
};

/**
 * Core request helper.
 */
async function request<T>(
  endpoint: string,
  init: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(init.headers || {}),
  };

  try {
    const resp = await fetch(url, { ...init, headers });
    const contentType = resp.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');

    if (!resp.ok) {
      let errMsg = 'Request failed';
      let errDetails: any;
      if (isJson) {
        const data = await resp.json();
        errMsg = data.message || data.error || errMsg;
        errDetails = data.details;
      }
      // Map status codes to typed errors
      switch (resp.status) {
        case 400:
          throw new ValidationError(errMsg, errDetails);
        case 401:
          throw new AuthError(errMsg);
        case 403:
          throw new ForbiddenError(errMsg);
        case 404:
          throw new NotFoundError(errMsg);
        case 500:
        default:
          throw new ServerError(errMsg, errDetails);
      }
    }

    if (isJson) {
      return (await resp.json()) as T;
    }
    // fallback to text for non‑json bodies (e.g., health check plain text)
    return (await resp.text()) as unknown as T;
  } catch (e) {
    if (e instanceof ApiError) {
      throw e;
    }
    // Network errors or unexpected exceptions
    throw new ServerError('Network or unexpected error', e);
  }
}

/**
 * Exported grouped API functions.
 */
export const api = {
  // expose token setter for AuthContext
  setAuthToken,

  auth: {
    login: ({ email, password }: { email: string; password: string }) =>
      request<{ token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: ({ fullName, email, phone, password }: { fullName: string; email: string; phone: string; password: string }) =>
      request<{ token: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, phone, password }),
      }),
  },

  customers: {
    getAll: () => request<{ customers: any[] }>('/customers'),
    get: (id: string) => request<{ customer: any }>(`/customers/${id}`),
    create: (data: CreateCustomerInput) =>
      request<{ customer: any }>('/customers/create-customer', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  accounts: {
    getAll: () => request<{ accounts: any[] }>('/accounts'),
    get: (id: string) => request<{ account: any }>(`/accounts/${id}`),
    create: (data: CreateAccountInput) =>
      request<{ account: any }>('/accounts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateStatus: (accountNumber: string, data: UpdateAccountStatusInput) =>
      request<{ account: any }>(`/accounts/${accountNumber}/status`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  banking: {
    deposit: (data: DepositInput, idempotencyKey: string) =>
      request<{ success: true; data: any }>('/banking/deposit', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(data),
      }).then(r => r.data),
    withdraw: (data: WithdrawInput, idempotencyKey: string) =>
      request<{ success: true; data: any }>('/banking/withdraw', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(data),
      }).then(r => r.data),
    transfer: (data: TransferInput, idempotencyKey: string) =>
      request<{ success: true; data: any }>('/banking/transfer', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(data),
      }).then(r => r.data),
    getBalance: (accountNumber: string, at?: string) => {
      const qs = at ? `?at=${encodeURIComponent(at)}` : '';
      return request<{ success: true; data: any }>(`/banking/${accountNumber}/balance${qs}`).then(r => r.data);
    },
    getHistory: (accountNumber: string, params: PaginationParams = {}) => {
      const sp = new URLSearchParams();
      if (params.page) sp.append('page', String(params.page));
      if (params.limit) sp.append('limit', String(params.limit));
      if (params.sort) sp.append('sort', params.sort);
      const qs = sp.toString() ? `?${sp}` : '';
      return request<{ success: true; data: any }>(`/banking/${accountNumber}/history${qs}`).then(r => r.data);
    },
  },

  transactions: {
    get: (id: string) => request<{ success: true; data: any }>(`/transactions/${id}`).then(r => r.data),
  },

  health: {
    check: () => request<{ status: string }>('/health'),
  },
};

export type ApiErrorTypes = ApiError | ValidationError | AuthError | ForbiddenError | NotFoundError | ServerError;
